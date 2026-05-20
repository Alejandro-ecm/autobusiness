package com.autobusiness.api;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> handleNoResource(NoResourceFoundException ex) {
        log.warn("Endpoint not found: {} {}", ex.getHttpMethod(), ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(error("Endpoint not found: " + ex.getResourcePath()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("Validation failed: {}", message);
        return ResponseEntity.badRequest().body(error(message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleBadRequest(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(error(ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<?> handleConflict(IllegalStateException ex) {
        log.warn("Conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error(ex.getMessage()));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> handleForbidden(SecurityException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error("Acceso denegado"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error("No tienes permiso para esta acción"));
    }

    @ExceptionHandler(NumberFormatException.class)
    public ResponseEntity<?> handleNumberFormat(NumberFormatException ex) {
        log.warn("Número inválido en request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(error("Valor numérico inválido en la petición"));
    }

    @ExceptionHandler(ClassCastException.class)
    public ResponseEntity<?> handleClassCast(ClassCastException ex) {
        log.warn("Tipo de dato incorrecto: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(error("Formato de datos inválido — revisa los tipos enviados"));
    }

    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<?> handleNullPointer(NullPointerException ex) {
        log.error("Campo requerido faltante", ex);
        return ResponseEntity.badRequest().body(error("Falta un campo requerido en la petición"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error("Error interno — intenta de nuevo"));
    }

    private Map<String, Object> error(String message) {
        return Map.of("error", message, "timestamp", Instant.now().toString());
    }
}
