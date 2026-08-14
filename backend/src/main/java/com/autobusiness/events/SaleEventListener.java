package com.autobusiness.events;

import com.autobusiness.domain.model.Sale;
import com.autobusiness.domain.model.SaleItem;
import com.autobusiness.domain.model.Alert;
import com.autobusiness.domain.repository.AlertRepository;
import com.autobusiness.domain.repository.ProductRepository;
import com.autobusiness.domain.service.AiEmployeeJobsService;
import com.autobusiness.infrastructure.ai.AiEngineClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SaleEventListener {

    private final AlertRepository alertRepo;
    private final ProductRepository productRepo;
    private final AiEngineClient aiEngineClient;
    private final AiEmployeeJobsService aiEmployeeJobs;

    @Async
    @EventListener
    public void onSaleCreated(SaleCreatedEvent event) {
        Sale sale = event.getSale();
        log.info("event=sale.created sale={} business={} items={}",
                sale.getId(), sale.getBusiness().getId(), sale.getItems().size());

        for (SaleItem item : sale.getItems()) {
            if (item.getProduct() == null) continue; // ítem libre, sin producto de inventario
            try {
                if (item.getProduct().isLowStock()) {
                    boolean critical = item.getProduct().getStock().compareTo(java.math.BigDecimal.ZERO) == 0;
                    String stockStr = item.getProduct().getStock().stripTrailingZeros().toPlainString();
                    alertRepo.save(Alert.builder()
                            .business(sale.getBusiness())
                            .branch(sale.getBranch())
                            .type("STOCK_LOW")
                            .severity(critical ? "CRITICAL" : "WARNING")
                            .message((critical ? "⛔ Sin stock: " : "⚠️ Stock bajo: ")
                                    + item.getProduct().getName()
                                    + " — " + stockStr + " " + item.getProduct().getBaseUnit() + " restantes")
                            .referenceType("product")
                            .referenceId(item.getProduct().getId())
                            .build());
                    log.warn("event=stock.low product={} stock={}",
                            item.getProduct().getName(), stockStr);

                    // Repositor IA: aviso inmediato por WhatsApp cuando se agota
                    if (critical) {
                        aiEmployeeJobs.notifyOutOfStock(
                                sale.getBusiness().getId(), item.getProduct().getName());
                    }
                }
            } catch (Exception e) {
                log.error("Failed to process stock alert for product {}", item.getProduct().getId(), e);
            }
        }

        aiEngineClient.triggerAnalysis(sale.getBusiness().getId());
    }
}
