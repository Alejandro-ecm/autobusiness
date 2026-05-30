package com.autobusiness.domain.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
public class CloudinaryService {

    private final Cloudinary cloudinary;

    public CloudinaryService(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret) {
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public String upload(byte[] imageBytes, String folder) {
        try {
            Map result = cloudinary.uploader().upload(imageBytes, ObjectUtils.asMap(
                    "folder", "autobusiness/" + folder,
                    "resource_type", "image"
            ));
            return result.get("secure_url").toString();
        } catch (Exception e) {
            log.error("Cloudinary upload error: {}", e.getMessage());
            throw new RuntimeException("Error al subir imagen");
        }
    }
}
