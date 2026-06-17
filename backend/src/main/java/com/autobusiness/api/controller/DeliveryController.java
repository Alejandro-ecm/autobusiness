package com.autobusiness.api.controller;

import com.autobusiness.domain.model.Order;
import com.autobusiness.domain.model.Sale;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.OrderRepository;
import com.autobusiness.domain.repository.SaleRepository;
import com.autobusiness.domain.service.OnlineStoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", methods = {
    RequestMethod.GET, RequestMethod.POST, RequestMethod.PATCH, RequestMethod.OPTIONS
})
@RestController
@RequestMapping("/delivery")
@RequiredArgsConstructor
@Slf4j
public class DeliveryController {

    private final BusinessRepository businessRepo;
    private final OrderRepository    orderRepo;
    private final SaleRepository     saleRepo;
    private final OnlineStoreService storeService;

    private static final Set<String> ACTIVE_STATUSES = Set.of("pending", "confirmed", "preparing", "ready");

    /** GET /api/delivery/orders?code=XXXXXXXXXX — pedidos activos para el repartidor */
    @GetMapping("/orders")
    public ResponseEntity<?> getDeliveryOrders(@RequestParam String code) {
        return businessRepo.findByDeliveryCode(code.toUpperCase().trim())
                .map(business -> {
                    List<Order> orders = orderRepo.findByBusinessIdOrderByCreatedAtDesc(business.getId())
                            .stream()
                            .filter(o -> ACTIVE_STATUSES.contains(o.getStatus()))
                            .collect(Collectors.toList());

                    List<Map<String, Object>> result = orders.stream().map(o -> {
                        Map<String, Object> map = new java.util.LinkedHashMap<>();
                        map.put("id",              o.getId());
                        map.put("orderNumber",     o.getOrderNumber());
                        map.put("status",          o.getStatus());
                        map.put("customerName",    o.getCustomerName());
                        map.put("customerPhone",   o.getCustomerPhone());
                        map.put("customerEmail",   o.getCustomerEmail());
                        map.put("deliveryAddress", o.getDeliveryAddress());
                        map.put("deliveryLat",     o.getDeliveryLat());
                        map.put("deliveryLng",     o.getDeliveryLng());
                        String lat = o.getDeliveryLat()  != null ? o.getDeliveryLat().toString()  : null;
                        String lng = o.getDeliveryLng() != null ? o.getDeliveryLng().toString() : null;
                        String mapsView = o.getMapsUrl() != null ? o.getMapsUrl()
                                : (lat != null ? "https://www.google.com/maps?q=" + lat + "," + lng : null);
                        String navUrl  = lat != null
                                ? "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng + "&travelmode=driving"
                                : null;
                        String wazeUrl = lat != null
                                ? "https://waze.com/ul?ll=" + lat + "," + lng + "&navigate=yes"
                                : null;
                        map.put("mapsUrl",  mapsView);
                        map.put("navUrl",   navUrl);
                        map.put("wazeUrl",  wazeUrl);
                        map.put("total",           o.getTotal());
                        map.put("paymentMethod",   o.getPaymentMethod() != null ? o.getPaymentMethod() : "cash_on_delivery");
                        map.put("createdAt",       o.getCreatedAt());
                        map.put("items",           o.getItems().stream().map(i -> Map.of(
                                "name",     i.getProduct() != null ? i.getProduct().getName() : "Producto",
                                "quantity", i.getQuantity(),
                                "price",    i.getUnitPrice()
                        )).collect(Collectors.toList()));
                        return map;
                    }).collect(Collectors.toList());

                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("businessName", business.getName());
                    resp.put("logoUrl",      business.getLogoUrl());
                    resp.put("bannerUrl",    business.getBannerUrl());
                    resp.put("orders",       result);
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.status(404).body(Map.of("error", "Código de delivery inválido")));
    }

    /** POST /api/delivery/orders/:id/deliver?code=XXXXXXXXXX — marca el pedido como entregado */
    @PostMapping("/orders/{orderId}/deliver")
    @Transactional
    public ResponseEntity<?> markDelivered(
            @PathVariable UUID orderId,
            @RequestParam String code) {
        return businessRepo.findByDeliveryCode(code.toUpperCase().trim())
                .map(business -> {
                    Order order = orderRepo.findById(orderId).orElse(null);
                    if (order == null) return ResponseEntity.status(404).body(Map.of("error", "Pedido no encontrado"));
                    if (!order.getBusiness().getId().equals(business.getId()))
                        return ResponseEntity.status(403).body(Map.of("error", "Pedido no pertenece a este negocio"));
                    order.setStatus("delivered");
                    orderRepo.save(order);
                    // Efectivo en entrega: registrar la venta cuando el repartidor cobra
                    if ("cash_on_delivery".equals(order.getPaymentMethod())) {
                        try {
                            storeService.createSaleFromOrder(order);
                        } catch (Exception e) {
                            log.error("No se pudo registrar venta para order {}: {}", orderId, e.getMessage());
                        }
                    }
                    return ResponseEntity.ok(Map.of("id", order.getId(), "status", "delivered"));
                })
                .orElse(ResponseEntity.status(404).body(Map.of("error", "Código de delivery inválido")));
    }

    /** GET /api/delivery/earnings?code=XXXXXXXXXX — ganancias del repartidor desde AutoBusiness AI */
    @GetMapping("/earnings")
    public ResponseEntity<?> getEarnings(@RequestParam String code) {
        return businessRepo.findByDeliveryCode(code.toUpperCase().trim())
                .map(business -> {
                    // Solo ventas del canal online (creadas por delivery) completadas
                    List<Sale> onlineSales = saleRepo.findByBusinessIdOrderByCreatedAtDesc(business.getId())
                            .stream()
                            .filter(s -> "online".equals(s.getChannel()) && "completed".equals(s.getStatus()))
                            .collect(Collectors.toList());

                    // Batch-fetch orders para obtener orderNumber y customerName
                    List<UUID> sourceIds = onlineSales.stream()
                            .filter(s -> s.getSourceOrderId() != null)
                            .map(Sale::getSourceOrderId)
                            .collect(Collectors.toList());
                    Map<UUID, Order> ordersMap = orderRepo.findAllById(sourceIds).stream()
                            .collect(Collectors.toMap(Order::getId, o -> o));

                    // Ventana de hoy en zona horaria del servidor
                    ZoneId zone = ZoneId.systemDefault();
                    Instant todayStart = LocalDate.now(zone).atStartOfDay(zone).toInstant();
                    Instant todayEnd = todayStart.plus(1, ChronoUnit.DAYS);

                    BigDecimal todayEarnings = BigDecimal.ZERO;
                    long todayDeliveries = 0;
                    BigDecimal allTimeTotal = BigDecimal.ZERO;
                    List<Map<String, Object>> history = new ArrayList<>();

                    for (Sale sale : onlineSales) {
                        allTimeTotal = allTimeTotal.add(sale.getTotal());
                        if (!sale.getCreatedAt().isBefore(todayStart) && sale.getCreatedAt().isBefore(todayEnd)) {
                            todayEarnings = todayEarnings.add(sale.getTotal());
                            todayDeliveries++;
                        }
                        Order order = sale.getSourceOrderId() != null ? ordersMap.get(sale.getSourceOrderId()) : null;
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("orderId",      sale.getSourceOrderId() != null ? sale.getSourceOrderId().toString() : null);
                        entry.put("orderNumber",  order != null ? order.getOrderNumber() : "ORD");
                        entry.put("customerName", order != null ? order.getCustomerName() : "");
                        entry.put("total",        sale.getTotal() != null ? sale.getTotal().doubleValue() : 0.0);
                        entry.put("isCash",       "cash".equals(sale.getPaymentMethod()));
                        entry.put("collectedAt",  sale.getCreatedAt());
                        history.add(entry);
                    }

                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("todayEarnings",    todayEarnings.doubleValue());
                    resp.put("todayDeliveries",  todayDeliveries);
                    resp.put("allTimeTotal",     allTimeTotal.doubleValue());
                    resp.put("allTimeDeliveries", onlineSales.size());
                    resp.put("history",           history);
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.status(404).body(Map.of("error", "Código de delivery inválido")));
    }

    /** PATCH /api/delivery/orders/:id/status?code=XXXXXXXXXX — cambia el estado del pedido */
    @PatchMapping("/orders/{orderId}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID orderId,
            @RequestParam String code,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Campo 'status' requerido"));

        return businessRepo.findByDeliveryCode(code.toUpperCase().trim())
                .map(business -> {
                    Order order = orderRepo.findById(orderId).orElse(null);
                    if (order == null) return ResponseEntity.status(404).body(Map.of("error", "Pedido no encontrado"));
                    if (!order.getBusiness().getId().equals(business.getId()))
                        return ResponseEntity.status(403).body(Map.of("error", "Pedido no pertenece a este negocio"));
                    order.setStatus(status.toLowerCase());
                    orderRepo.save(order);
                    return ResponseEntity.ok(Map.of("id", order.getId(), "status", order.getStatus()));
                })
                .orElse(ResponseEntity.status(404).body(Map.of("error", "Código de delivery inválido")));
    }
}
