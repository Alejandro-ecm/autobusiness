package com.autobusiness.api.controller;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.repository.BusinessRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/marketplace")
@RequiredArgsConstructor
public class MarketplaceController {

    private final BusinessRepository businessRepo;

    @GetMapping("/stores")
    public List<Map<String, Object>> listStores(
            @RequestParam(required = false, defaultValue = "") String q) {

        return businessRepo.findAll().stream()
                .filter(b -> b.getSlug() != null && !b.getSlug().isBlank())
                .filter(b -> q.isBlank()
                        || b.getName().toLowerCase().contains(q.toLowerCase())
                        || (b.getDescription() != null && b.getDescription().toLowerCase().contains(q.toLowerCase())))
                .map(this::toPublicMap)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toPublicMap(Business b) {
        return Map.of(
                "slug",        b.getSlug(),
                "name",        b.getName(),
                "description", b.getDescription() != null ? b.getDescription() : "",
                "logoUrl",     b.getLogoUrl()    != null ? b.getLogoUrl()    : "",
                "bannerUrl",   b.getBannerUrl()  != null ? b.getBannerUrl()  : "",
                "plan",        b.getPlan()       != null ? b.getPlan()       : "free"
        );
    }
}
