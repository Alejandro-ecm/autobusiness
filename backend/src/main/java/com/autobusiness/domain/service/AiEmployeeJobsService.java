package com.autobusiness.domain.service;

import com.autobusiness.domain.model.AiEmployee;
import com.autobusiness.domain.model.Customer;
import com.autobusiness.domain.model.Product;
import com.autobusiness.domain.repository.AiEmployeeRepository;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.CustomerRepository;
import com.autobusiness.domain.repository.ProductRepository;
import com.autobusiness.infrastructure.whatsapp.WhatsAppServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Tareas programadas de los Empleados IA:
 * - Cobrador IA: recordatorios de pago por WhatsApp a clientes con fiado pendiente.
 * - Repositor IA: reporte diario de inventario + tono amable, al propio WhatsApp del negocio.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiEmployeeJobsService {

    private static final int MAX_REMINDERS_PER_DAY = 25;   // evita spam y baneos
    private static final int REMINDER_COOLDOWN_DAYS = 3;   // no insistir a diario al mismo cliente

    private final AiEmployeeRepository aiEmployeeRepo;
    private final CustomerRepository customerRepo;
    private final ProductRepository productRepo;
    private final BusinessRepository businessRepo;
    private final WhatsAppServiceClient waClient;

    /** 15:00 UTC ≈ 9:00 am CDMX — recordatorios de fiado pendiente. */
    @Scheduled(cron = "0 0 15 * * *")
    @Transactional
    public void cobradorReminders() {
        for (AiEmployee emp : aiEmployeeRepo.findByEmployeeTypeAndEnabledTrue("cobrador")) {
            UUID bid = emp.getBusinessId();
            String bizName = businessRepo.findById(bid).map(b -> b.getName()).orElse("tu tienda");
            List<Customer> deudores = customerRepo
                    .findByBusinessIdAndIsActiveTrueAndTotalCreditGreaterThan(bid, BigDecimal.ZERO);
            int sent = 0;
            for (Customer c : deudores) {
                if (sent >= MAX_REMINDERS_PER_DAY) break;
                if (c.getPhone() == null || c.getPhone().isBlank()) continue;
                if (c.getCobradorRemindedAt() != null &&
                        c.getCobradorRemindedAt().isAfter(Instant.now().minus(REMINDER_COOLDOWN_DAYS, ChronoUnit.DAYS))) {
                    continue;
                }
                String text = "Hola " + c.getName() + " 👋 Te saluda *" + bizName + "*.\n\n"
                        + "Te recordamos con cariño que tienes un saldo pendiente de *$"
                        + c.getTotalCredit().setScale(2) + "*.\n\n"
                        + "Puedes pasar a abonar cuando gustes. Si ya pagaste, ignora este mensaje. ¡Gracias! 🙏";
                boolean ok = waClient.sendToPhone(bid, c.getPhone(), text);
                if (!ok) {
                    // Sesión caída o número inválido — no insistir con el resto hoy
                    log.info("Cobrador IA: no se pudo enviar a {} (business {}), se detiene la ronda", c.getPhone(), bid);
                    break;
                }
                c.setCobradorRemindedAt(Instant.now());
                customerRepo.save(c);
                sent++;
                pause(2500); // espaciar envíos — comportamiento humano
            }
            if (sent > 0) log.info("Cobrador IA: {} recordatorios enviados para business {}", sent, bid);
        }
    }

    /** 14:00 UTC ≈ 8:00 am CDMX — reporte de inventario al chat propio del negocio. */
    @Scheduled(cron = "0 0 14 * * *")
    @Transactional(readOnly = true)
    public void repositorDailyReport() {
        for (AiEmployee emp : aiEmployeeRepo.findByEmployeeTypeAndEnabledTrue("repositor")) {
            UUID bid = emp.getBusinessId();
            List<Product> low = productRepo.findLowStock(bid);
            if (low.isEmpty()) continue; // todo en orden — no hay nada que avisar

            StringBuilder sb = new StringBuilder("📦 *Repositor IA — Reporte de inventario*\n");
            long agotados = low.stream().filter(p -> p.getStock().compareTo(BigDecimal.ZERO) <= 0).count();
            if (agotados > 0) {
                sb.append("\n⛔ *Agotados (").append(agotados).append("):*\n");
                low.stream()
                        .filter(p -> p.getStock().compareTo(BigDecimal.ZERO) <= 0)
                        .limit(15)
                        .forEach(p -> sb.append("• ").append(p.getName()).append("\n"));
            }
            long bajos = low.size() - agotados;
            if (bajos > 0) {
                sb.append("\n⚠️ *Stock bajo (").append(bajos).append("):*\n");
                low.stream()
                        .filter(p -> p.getStock().compareTo(BigDecimal.ZERO) > 0)
                        .limit(15)
                        .forEach(p -> sb.append("• ").append(p.getName())
                                .append(" — quedan ").append(p.getStock().stripTrailingZeros().toPlainString())
                                .append("\n"));
            }
            sb.append("\nRevisa Compras para resurtir a tiempo. 💪");
            if (waClient.notifySelf(bid, sb.toString())) {
                log.info("Repositor IA: reporte diario enviado para business {}", bid);
            }
        }
    }

    /** Aviso inmediato cuando un producto se agota (lo llama SaleEventListener). */
    public void notifyOutOfStock(UUID businessId, String productName) {
        boolean enabled = aiEmployeeRepo.findByBusinessIdAndEmployeeType(businessId, "repositor")
                .map(AiEmployee::isEnabled).orElse(false);
        if (!enabled) return;
        waClient.notifySelf(businessId,
                "⛔ *Repositor IA:* ¡\"" + productName + "\" se acaba de agotar!\n"
                        + "Considera resurtirlo pronto para no perder ventas.");
    }

    private void pause(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
