package com.autobusiness.events;

import com.autobusiness.domain.model.Alert;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class AlertCreatedEvent extends ApplicationEvent {
    private final Alert alert;

    public AlertCreatedEvent(Alert alert) {
        super(alert);
        this.alert = alert;
    }
}
