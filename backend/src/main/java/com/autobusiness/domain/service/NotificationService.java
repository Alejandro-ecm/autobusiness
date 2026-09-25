package com.autobusiness.domain.service;

import com.autobusiness.domain.model.PushSubscription;
import com.autobusiness.domain.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final PushSubscriptionRepository pushRepo;

    @Value("${vapid.public-key}")
    private String vapidPublicKey;
    @Value("${vapid.private-key}")
    private String vapidPrivateKey;
    @Value("${vapid.subject}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    void init() {
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
        } catch (Exception e) {
            // No tumbamos el arranque del backend por esto — las push notifications
            // quedan deshabilitadas (sendPush hace no-op) pero el resto de la app sigue.
            log.error("No se pudo inicializar VAPID/PushService, push notifications deshabilitadas: {}", e.getMessage());
        }
    }

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

    /** Envía notificación push (Web Push + VAPID) a todos los dispositivos suscritos del negocio. */
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
        if (pushService == null) {
            log.warn("PushService no inicializado — se omite el envio a {}", sub.getEndpoint());
            return;
        }
        try {
            Notification notification = new Notification(
                    sub.getEndpoint(), sub.getP256dh(), sub.getAuth(), payload);
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                // Suscripcion vencida o revocada por el navegador — ya no sirve, se borra.
                pushRepo.deleteByEndpoint(sub.getEndpoint());
                log.info("push.subscription.gone endpoint={}", sub.getEndpoint());
            } else if (status >= 300) {
                log.warn("push.failed status={} endpoint={}", status, sub.getEndpoint());
            }
        } catch (Exception e) {
            log.warn("Push failed for endpoint {}: {}", sub.getEndpoint(), e.getMessage());
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\"", "\\\"").replace("\n", "\\n");
    }

    public List<PushSubscription> getSubscriptions(UUID businessId) {
        return pushRepo.findByBusinessId(businessId);
    }
}
