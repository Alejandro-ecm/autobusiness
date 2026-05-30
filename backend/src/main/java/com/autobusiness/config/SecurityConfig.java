package com.autobusiness.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.allowed-origins:http://localhost:3000,http://localhost:5173,http://localhost:4173}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Públicos sin autenticación
                        .requestMatchers(
                                "/auth/**",
                                "/store/**",
                                "/marketplace/**",                          // buscador público de tiendas
                                "/delivery/**",                             // app de delivery (sync por código)
                                "/health",
                                "/actuator/**",
                                "/subscription/plans",                      // precios públicos
                                "/payments/mercadopago/webhook",            // webhook MP sin JWT
                                "/settings/mp/oauth-callback",              // redirect de MP OAuth
                                "/store/*/process-payment"                  // Checkout Bricks card payment
                        ).permitAll()
                        // Super admin
                        .requestMatchers("/super-admin/**").hasRole("SUPER_ADMIN")
                        // Owner/Admin
                        .requestMatchers("/admin/**").hasAnyRole("OWNER", "ADMIN")
                        // Todo lo demás requiere JWT válido
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        // 401 para no-autenticados (token ausente/expirado)
                        // El interceptor axios lo redirige al login automáticamente
                        .authenticationEntryPoint((request, response, e) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write(
                                "{\"error\":\"Sesión expirada, inicia sesión de nuevo\"," +
                                "\"timestamp\":\"" + Instant.now() + "\"}"
                            );
                        })
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        // /delivery/** es una API pública — acepta cualquier origen (apps de delivery externas)
        CorsConfiguration publicConfig = new CorsConfiguration();
        publicConfig.setAllowedOriginPatterns(List.of("*"));
        publicConfig.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        publicConfig.setAllowedHeaders(List.of("*"));
        publicConfig.setAllowCredentials(false);
        source.registerCorsConfiguration("/delivery/**", publicConfig);

        // Resto de rutas — solo orígenes autorizados
        List<String> origins = new java.util.ArrayList<>(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList()));
        origins.add("capacitor://localhost");
        origins.add("https://localhost");
        origins.add("http://localhost");
        origins.add("https://autobusiness.skytechnologieslatam.com");
        origins.add("https://app.skytechnologieslatam.com");
        origins.add("https://skytechnologieslatam.com");
        origins.add("https://www.skytechnologieslatam.com");
        origins.add("https://*.vercel.app");
        origins.add("https://*.up.railway.app");
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
