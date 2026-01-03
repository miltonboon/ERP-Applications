sap.ui.define([
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/format/DateFormat"
], (NumberFormat, DateFormat) => {
    "use strict";

    const statusStateMap = {
        Paid: "Success",
        Cancelled: "Error",
        Submitted: "Warning"
    };

    const amountFormatter = NumberFormat.getFloatInstance({
        minFractionDigits: 2,
        maxFractionDigits: 2
    });

    const dateFormatter = DateFormat.getDateInstance({ style: "medium" });

    return {
        formatCustomerName(firstName, lastName) {
            const first = firstName || "";
            const last = lastName || "";
            const name = `${first} ${last}`.trim();
            return name || "Unknown customer";
        },

        formatStatusState(status) {
            return statusStateMap[status] || "None";
        },

        formatAmount(value) {
            let number = null;
            if (typeof value === "number") {
                number = value;
            } else if (typeof value === "string") {
                const normalized = value.replace(/[^0-9.-]/g, "");
                number = parseFloat(normalized);
            }
            if (Number.isNaN(number)) {
                return amountFormatter.format(0);
            }
            return amountFormatter.format(number);
        },

        formatOrderType(type) {
            if (!type) {
                return "";
            }
            if (type === "FoodDrinks") {
                return "Food & Drinks";
            }
            if (type === "Ticket") {
                return "Tickets";
            }
            return type;
        },

        formatDate(value) {
            if (!value) {
                return "";
            }
            const dateObj = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(dateObj.getTime())) {
                return "";
            }
            return dateFormatter.format(dateObj);
        },

        calculateItemTotal(quantity, unitPrice) {
            const qty = typeof quantity === "number" ? quantity : parseFloat(quantity);
            const price = typeof unitPrice === "number" ? unitPrice : parseFloat(unitPrice);
            if (Number.isNaN(qty) || Number.isNaN(price)) {
                return amountFormatter.format(0);
            }
            return amountFormatter.format(qty * price);
        },

        calculateOrderTotal(items) {
            const collection = Array.isArray(items) ? items : [];
            const total = collection.reduce((sum, item) => {
                const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity);
                const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(item.unitPrice);
                if (Number.isNaN(qty) || Number.isNaN(price)) {
                    return sum;
                }
                return sum + (qty * price);
            }, 0);
            return amountFormatter.format(total);
        },

        displayOrderTotal(items, overviewTotal) {
            const hasOverview = overviewTotal !== undefined && overviewTotal !== null;
            if (hasOverview) {
                return this.formatAmount(overviewTotal);
            }
            return this.calculateOrderTotal(items);
        }
    };
});
