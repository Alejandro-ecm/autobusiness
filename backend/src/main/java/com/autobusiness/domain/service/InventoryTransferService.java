package com.autobusiness.domain.service;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.config.JwtUtil;
import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class InventoryTransferService {

    private final InventoryTransferRepository transferRepo;
    private final InventoryMovementRepository movementRepo;
    private final ProductRepository productRepo;
    private final BusinessRepository businessRepo;
    private final UserRepository userRepo;
    private final JwtUtil jwtUtil;

    public record TransferRequest(
            UUID sourceProductId,
            UUID destinationBusinessId,
            BigDecimal quantity,
            String notes,
            String destinationToken
    ) {}

    @Transactional
    public Map<String, Object> transfer(AuthPrincipal sourcePrincipal, TransferRequest req) {
        validateRequest(sourcePrincipal, req);
        DestinationAuthorization destinationAuth = authorizeDestination(req);

        Product source = productRepo.findByIdForUpdate(req.sourceProductId())
                .orElseThrow(() -> new IllegalArgumentException("Producto origen no encontrado"));
        if (!source.getBusiness().getId().equals(sourcePrincipal.businessId())) {
            throw new IllegalArgumentException("El producto no pertenece al negocio activo");
        }
        if (source.getStock().compareTo(req.quantity()) < 0) {
            throw new IllegalStateException("Stock insuficiente. Disponible: "
                    + source.getStock().stripTrailingZeros().toPlainString());
        }

        Business destinationBusiness = businessRepo.findById(req.destinationBusinessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio destino no encontrado"));
        if (!destinationBusiness.isActive() || destinationBusiness.isSuspended()) {
            throw new IllegalStateException("El negocio destino no está activo");
        }

        BigDecimal quantity = req.quantity().stripTrailingZeros();
        BigDecimal unitCost = valueOrZero(source.getCost());
        BigDecimal totalCost = unitCost.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        BigDecimal unitPrice = valueOrZero(source.getPrice());
        BigDecimal totalRetailValue = unitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);

        Product destination = findMatchingDestinationProduct(destinationBusiness.getId(), source)
                .map(product -> productRepo.findByIdForUpdate(product.getId()).orElse(product))
                .map(product -> applyIncomingStock(product, quantity, unitCost))
                .orElseGet(() -> createDestinationProduct(destinationBusiness, source, quantity, unitCost));

        source.setStock(source.getStock().subtract(quantity));
        productRepo.save(source);
        productRepo.save(destination);

        User sourceUser = userRepo.findById(sourcePrincipal.userId()).orElse(null);
        InventoryTransfer transfer = transferRepo.saveAndFlush(InventoryTransfer.builder()
                .sourceBusiness(source.getBusiness())
                .destinationBusiness(destinationBusiness)
                .sourceProduct(source)
                .destinationProduct(destination)
                .quantity(quantity)
                .unitCost(unitCost)
                .totalCost(totalCost)
                .unitPrice(unitPrice)
                .totalRetailValue(totalRetailValue)
                .notes(trimNotes(req.notes()))
                .createdBy(sourceUser)
                .destinationAuthorizedBy(destinationAuth.user())
                .build());

        movementRepo.save(InventoryMovement.builder()
                .business(source.getBusiness())
                .product(source)
                .type("TRANSFER_OUT")
                .quantity(quantity)
                .reason("Transferencia " + transfer.getId() + " a " + destinationBusiness.getName())
                .createdBy(sourceUser)
                .build());
        movementRepo.save(InventoryMovement.builder()
                .business(destinationBusiness)
                .product(destination)
                .type("TRANSFER_IN")
                .quantity(quantity)
                .reason("Transferencia " + transfer.getId() + " desde " + source.getBusiness().getName())
                .createdBy(destinationAuth.user())
                .build());

        return toResponse(transfer, sourcePrincipal.businessId());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(UUID businessId) {
        return transferRepo
                .findTop50BySourceBusinessIdOrDestinationBusinessIdOrderByCreatedAtDesc(businessId, businessId)
                .stream()
                .map(t -> toResponse(t, businessId))
                .toList();
    }

    private void validateRequest(AuthPrincipal principal, TransferRequest req) {
        if (req == null || req.sourceProductId() == null || req.destinationBusinessId() == null) {
            throw new IllegalArgumentException("Producto y negocio destino son requeridos");
        }
        if (req.quantity() == null || req.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser mayor a cero");
        }
        if (principal.businessId().equals(req.destinationBusinessId())) {
            throw new IllegalArgumentException("El negocio destino debe ser diferente al activo");
        }
        if (req.destinationToken() == null || req.destinationToken().isBlank()) {
            throw new IllegalArgumentException("Vuelve a conectar el negocio destino para autorizar la transferencia");
        }
    }

    private DestinationAuthorization authorizeDestination(TransferRequest req) {
        String token = req.destinationToken().startsWith("Bearer ")
                ? req.destinationToken().substring(7) : req.destinationToken();
        if (!jwtUtil.isValid(token)) {
            throw new IllegalArgumentException("La sesión del negocio destino expiró. Vuelve a conectarlo");
        }
        Claims claims = jwtUtil.parse(token);
        String businessId = claims.get("businessId", String.class);
        String role = claims.get("role", String.class);
        if (!req.destinationBusinessId().toString().equals(businessId)) {
            throw new IllegalArgumentException("La autorización no corresponde al negocio destino");
        }
        if (!Set.of("OWNER", "ADMIN").contains(role)) {
            throw new IllegalArgumentException("Se requiere una cuenta OWNER o ADMIN del negocio destino");
        }
        UUID userId = UUID.fromString(claims.getSubject());
        User user = userRepo.findById(userId)
                .filter(User::isActive)
                .orElseThrow(() -> new IllegalArgumentException("El usuario del negocio destino ya no está activo"));
        if (!user.getBusiness().getId().equals(req.destinationBusinessId())) {
            throw new IllegalArgumentException("Usuario destino inválido");
        }
        return new DestinationAuthorization(user);
    }

    private Optional<Product> findMatchingDestinationProduct(UUID businessId, Product source) {
        if (source.getBarcode() != null && !source.getBarcode().isBlank()) {
            Optional<Product> byBarcode = productRepo
                    .findFirstByBusinessIdAndBarcodeAndIsActiveTrue(businessId, source.getBarcode());
            if (byBarcode.isPresent()) return byBarcode;
        }
        if (source.getSku() != null && !source.getSku().isBlank()) {
            Optional<Product> bySku = productRepo
                    .findFirstByBusinessIdAndSkuIgnoreCaseAndIsActiveTrue(businessId, source.getSku());
            if (bySku.isPresent()) return bySku;
        }
        return productRepo.findFirstByBusinessIdAndNameIgnoreCaseAndIsActiveTrue(businessId, source.getName());
    }

    private Product createDestinationProduct(Business business, Product source, BigDecimal quantity, BigDecimal unitCost) {
        return productRepo.save(Product.builder()
                .business(business)
                .name(source.getName())
                .description(source.getDescription())
                .sku(source.getSku())
                .barcode(source.getBarcode())
                .price(source.getPrice())
                .cost(unitCost)
                .stock(quantity)
                .minStock(source.getMinStock())
                .imageUrl(source.getImageUrl())
                .isOnline(false)
                .saleMode(source.getSaleMode())
                .baseUnit(source.getBaseUnit())
                .allowsDecimal(source.isAllowsDecimal())
                .pricePerKg(source.getPricePerKg())
                .variants(source.getVariants())
                .build());
    }

    private Product applyIncomingStock(Product destination, BigDecimal quantity, BigDecimal unitCost) {
        BigDecimal oldStock = valueOrZero(destination.getStock());
        BigDecimal oldCost = valueOrZero(destination.getCost());
        BigDecimal newStock = oldStock.add(quantity);

        destination.setStock(newStock);
        if (newStock.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal weightedCost = oldStock.multiply(oldCost)
                    .add(quantity.multiply(unitCost))
                    .divide(newStock, 4, RoundingMode.HALF_UP);
            destination.setCost(weightedCost.setScale(2, RoundingMode.HALF_UP));
        }
        return destination;
    }

    private Map<String, Object> toResponse(InventoryTransfer t, UUID viewerBusinessId) {
        boolean outgoing = t.getSourceBusiness().getId().equals(viewerBusinessId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", t.getId());
        result.put("direction", outgoing ? "OUT" : "IN");
        result.put("sourceBusinessId", t.getSourceBusiness().getId());
        result.put("sourceBusinessName", t.getSourceBusiness().getName());
        result.put("destinationBusinessId", t.getDestinationBusiness().getId());
        result.put("destinationBusinessName", t.getDestinationBusiness().getName());
        result.put("productName", t.getSourceProduct().getName());
        result.put("sourceProductId", t.getSourceProduct().getId());
        result.put("destinationProductId", t.getDestinationProduct().getId());
        result.put("quantity", t.getQuantity());
        result.put("unit", t.getSourceProduct().getBaseUnit());
        result.put("unitCost", t.getUnitCost());
        result.put("totalCost", t.getTotalCost());
        result.put("unitPrice", t.getUnitPrice());
        result.put("totalRetailValue", t.getTotalRetailValue());
        result.put("status", t.getStatus());
        result.put("notes", t.getNotes() != null ? t.getNotes() : "");
        result.put("createdAt", t.getCreatedAt() != null ? t.getCreatedAt() : Instant.now());
        return result;
    }

    private String trimNotes(String notes) {
        if (notes == null || notes.isBlank()) return null;
        String trimmed = notes.trim();
        return trimmed.length() > 500 ? trimmed.substring(0, 500) : trimmed;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private record DestinationAuthorization(User user) {}
}
