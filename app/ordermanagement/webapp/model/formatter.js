sap.ui.define([
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/format/DateFormat"
], (NumberFormat, DateFormat) => {
    "use strict";

    const statusStateMap = {
        Paid: "Success",
        Cancelled: "Error",
        Submitted: "Information",
        Draft: "None"
    };

    const amountFormatter = NumberFormat.getFloatInstance({
        minFractionDigits: 2,
        maxFractionDigits: 2
    });

    const dateFormatter = DateFormat.getDateInstance({ style: "medium", UTC: true });

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
            const number = typeof value === "number" ? value : parseFloat(value);
            if (Number.isNaN(number)) {
                return amountFormatter.format(0);
            }
            return amountFormatter.format(number);
        },

        formatOrderType(type) {
            if (type === "FoodDrinks") {
                return "Food & Drinks";
            }
            return type || "";
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
        }
    };
});
