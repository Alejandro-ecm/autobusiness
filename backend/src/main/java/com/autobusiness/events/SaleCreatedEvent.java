package com.autobusiness.events;

import com.autobusiness.domain.model.Sale;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class SaleCreatedEvent extends ApplicationEvent {
    private final Sale sale;

    public SaleCreatedEvent(Sale sale) {
        super(sale);
        this.sale = sale;
    }
}
