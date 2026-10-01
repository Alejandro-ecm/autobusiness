package com.autobusiness.domain.service;

import com.autobusiness.config.JwtUtil;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.repository.BranchRepository;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.CustomerRepository;
import com.autobusiness.domain.repository.LegalAcceptanceRepository;
import com.autobusiness.domain.repository.PasswordResetTokenRepository;
import com.autobusiness.domain.repository.PendingRegistrationRepository;
import com.autobusiness.domain.repository.UserRepository;
import com.autobusiness.infrastructure.analytics.AlejandriaClient;
import com.autobusiness.infrastructure.email.ResendClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Cubre el blindaje del scheduler de eliminacion de cuentas (FASE 4):
 * limite real de 30 dias de gracia, anonimizacion vs. borrado, idempotencia
 * ante doble ejecucion, modo dry-run, cancelacion dentro del periodo de
 * gracia, y que el procesamiento de un negocio nunca toca a otro.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepo;
    @Mock private BusinessRepository businessRepo;
    @Mock private BranchRepository branchRepo;
    @Mock private SubscriptionService subscriptionService;
    @Mock private PendingRegistrationRepository pendingRepo;
    @Mock private PasswordResetTokenRepository resetTokenRepo;
    @Mock private PasswordEncoder encoder;
    @Mock private JwtUtil jwtUtil;
    @Mock private AlejandriaClient alejandria;
    @Mock private LegalService legalService;
    @Mock private ResendClient resendClient;
    @Mock private LegalAcceptanceRepository legalAcceptanceRepo;
    @Mock private CustomerRepository customerRepo;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepo, businessRepo, branchRepo, subscriptionService,
                pendingRepo, resetTokenRepo, encoder, jwtUtil, alejandria, legalService,
                resendClient, legalAcceptanceRepo, customerRepo);
    }

    private Business businessWithDeletionAge(long daysAgo) {
        return Business.builder()
                .id(UUID.randomUUID())
                .name("Negocio de prueba")
                .isActive(true)
                .deletionRequestedAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                .build();
    }

    @Test
    void negocioCon29DiasNoSeToca() {
        Business b = businessWithDeletionAge(29);
        when(businessRepo.findByDeletionRequestedAtIsNotNull()).thenReturn(List.of(b));

        authService.runScheduledDeletions();

        assertThat(b.isActive()).isTrue();
        assertThat(b.getDeletionRequestedAt()).isNotNull();
        verifyNoInteractions(userRepo);
        verify(businessRepo, never()).save(any());
    }

    @Test
    void negocioCon31DiasSeAnonimizaYLimpiaLaMarca() {
        Business b = businessWithDeletionAge(31);
        User u = User.builder().id(UUID.randomUUID()).business(b)
                .email("real@gmail.com").name("Dueño Real").role("OWNER").isActive(true).build();
        when(businessRepo.findByDeletionRequestedAtIsNotNull()).thenReturn(List.of(b));
        when(businessRepo.findById(b.getId())).thenReturn(Optional.of(b));
        when(userRepo.findByBusinessId(b.getId())).thenReturn(List.of(u));

        authService.runScheduledDeletions();

        assertThat(b.isActive()).isFalse();
        assertThat(b.isSuspended()).isTrue();
        assertThat(b.getDeletionRequestedAt()).isNull();
        assertThat(b.getName()).startsWith("[Eliminado]");
        assertThat(u.getEmail()).startsWith("deleted-");
        assertThat(u.getName()).isEqualTo("[Cuenta Eliminada]");
        assertThat(u.isActive()).isFalse();
        verify(businessRepo).save(b);
        verify(userRepo).save(u);
    }

    @Test
    void segundaEjecucionSobreElMismoNegocioEsNoOp() {
        Business b = businessWithDeletionAge(31);
        when(businessRepo.findById(b.getId())).thenReturn(Optional.of(b));

        authService.executeAccountDeletion(b.getId()); // 1a vez: anonimiza y marca isActive=false
        reset(userRepo); // medir solo lo que haga la 2a corrida
        authService.executeAccountDeletion(b.getId()); // 2a vez: ya inactivo -> debe ser no-op

        verifyNoInteractions(userRepo);
    }

    @Test
    void modoDryRunNuncaEjecutaLaEliminacionReal() {
        Business b = businessWithDeletionAge(31);
        when(businessRepo.findByDeletionRequestedAtIsNotNull()).thenReturn(List.of(b));
        ReflectionTestUtils.setField(authService, "deletionDryRun", true);

        authService.runScheduledDeletions();

        assertThat(b.isActive()).isTrue();
        assertThat(b.getDeletionRequestedAt()).isNotNull();
        verifyNoInteractions(userRepo);
        verify(businessRepo, never()).save(any());
    }

    @Test
    void cancelarDentroDelPeriodoDeGraciaLimpiaLaMarca() {
        Business b = businessWithDeletionAge(10);
        User owner = User.builder().id(UUID.randomUUID()).business(b).role("OWNER").build();
        when(userRepo.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(businessRepo.findById(b.getId())).thenReturn(Optional.of(b));

        authService.cancelAccountDeletion(owner.getId(), b.getId());

        assertThat(b.getDeletionRequestedAt()).isNull();
        verify(businessRepo).save(b);
    }

    @Test
    void noPermiteCancelarUnaCuentaYaEliminada() {
        Business b = businessWithDeletionAge(31);
        b.setActive(false); // ya fue procesada por el scheduler
        User owner = User.builder().id(UUID.randomUUID()).business(b).role("OWNER").build();
        when(userRepo.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(businessRepo.findById(b.getId())).thenReturn(Optional.of(b));

        assertThatThrownBy(() -> authService.cancelAccountDeletion(owner.getId(), b.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void soloProcesaElNegocioQueCumplioElPlazoYNuncaCruzaConOtro() {
        Business vencido = businessWithDeletionAge(31);
        Business reciente = businessWithDeletionAge(5);
        when(businessRepo.findByDeletionRequestedAtIsNotNull()).thenReturn(List.of(vencido, reciente));
        when(businessRepo.findById(vencido.getId())).thenReturn(Optional.of(vencido));
        when(userRepo.findByBusinessId(vencido.getId())).thenReturn(List.of());

        authService.runScheduledDeletions();

        assertThat(vencido.isActive()).isFalse();
        assertThat(reciente.isActive()).isTrue();
        assertThat(reciente.getDeletionRequestedAt()).isNotNull();
        verify(businessRepo, never()).findById(reciente.getId());
    }
}
