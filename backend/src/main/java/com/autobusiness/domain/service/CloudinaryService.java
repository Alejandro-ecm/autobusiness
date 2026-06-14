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

    /**
     * Re-aloja una imagen externa (URL pegada por el usuario) en Cloudinary.
     * Cloudinary descarga la imagen del lado del servidor, evitando el bloqueo
     * de hotlinking que hace que muchas imágenes externas (bing, walmart,
     * amazon, gstatic...) no se vean en la tienda online del navegador.
     *
     * Si ya es una URL de Cloudinary, la deja igual. Si falla la descarga,
     * regresa la URL original (mejor algo que nada).
     */
    public String rehostIfExternal(String rawUrl, String folder) {
        if (rawUrl == null) return null;
        String url = rawUrl.trim();
        if (url.isEmpty()) return null;
        // Ya está en Cloudinary o no es http(s) → no tocar
        if (url.contains("res.cloudinary.com") || url.contains("cloudinary")) return url;
        if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
        try {
            Map result = cloudinary.uploader().upload(url, ObjectUtils.asMap(
                    "folder", "autobusiness/" + folder,
                    "resource_type", "image"
            ));
            return result.get("secure_url").toString();
        } catch (Exception e) {
            log.warn("No se pudo re-alojar imagen externa {}: {}", url, e.getMessage());
            return url; // fallback: deja la URL original
        }
    }
}
