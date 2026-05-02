package com.autobusiness.domain.service;

import com.autobusiness.domain.model.PushSubscription;
import com.autobusiness.domain.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final PushSubscriptionRepository pushRepo;
    private final WebClient.Builder webClientBuilder;

    @Transactional
    public PushSubscription subscribe(UUID businessId, UUID userId,
                                       String endpoint, String p256dh, String auth,
                                       String userAgent) {
        return pushRepo.findByEndpoint(endpoint).orElseGet(() -> {
            // Necesitamos el objeto Business, pero lo guardamos solo con IDs
            // para simplificar, guardamos la entidad con business stub
            var sub = new PushSubscription();
            sub.setUserId(userId);
            sub.setEndpoint(endpoint);
            sub.setP256dh(p256dh);
            sub.setAuth(auth);
            sub.setUserAgent(userAgent);
            // Necesita business — se setea en el controller
            return pushRepo.save(sub);
        });
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        pushRepo.deleteByEndpoint(endpoint);
    }

    /**
     * Envía notificación push a todos los dispositivos del negocio.
     * Usa Web Push Protocol con payload JSON.
     * En producción se requiere VAPID keys y librería java-webpush.
     * Aquí enviamos una notificación simple via endpoint directo.
     */
    public void sendToAll(UUID businessId, String title, String body, String url) {
        List<PushSubscription> subs = pushRepo.findByBusinessId(businessId);
        if (subs.isEmpty()) return;

        String payload = String.format(
                "{\"title\":\"%s\",\"body\":\"%s\",\"url\":\"%s\"}",
                escape(title), escape(body), url != null ? url : "/"
        );

        subs.forEach(sub -> {
            try {
                sendPush(sub, payload);
            } catch (Exception e) {
                log.warn("Push failed for endpoint {}: {}", sub.getEndpoint(), e.getMessage());
            }
        });
    }

    private void sendPush(PushSubscription sub, String payload) {
        // En producción: usar VAPID signing + Web Push encryption
        // Por ahora logeamos la notificación pendiente
        log.info("PUSH → {} | payload={}", sub.getEndpoint().substring(0, 40) + "...", payload);
        // TODO: integrar nl.martijndwars:web-push con VAPID keys cuando se configuren
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\"", "\\\"").replace("\n", "\\n");
    }

    public List<PushSubscription> getSubscriptions(UUID businessId) {
        return pushRepo.findByBusinessId(businessId);
    }
}
