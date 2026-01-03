sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "sap/m/MessageToast",
    "ordermanagement/ordermanagement/model/formatter",
    "ordermanagement/ordermanagement/controller/util/CustomerDialog",
    "ordermanagement/ordermanagement/controller/util/ExportPDF"
], (Controller, fLibrary, MessageToast, formatter, CustomerDialog, ExportPDF) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderDetail", {
        formatter,

        onInit() {
            this._customerDialog = new CustomerDialog(this);
            this._exportPdf = new ExportPDF(this);
        },

        onExit() {
            if (this._customerDialog) {
                this._customerDialog.destroy();
            }
        },

        onCloseDetail() {
            let parent = this.getView().getParent();
            while (parent && !parent.isA("sap.f.FlexibleColumnLayout")) {
                parent = parent.getParent();
            }
            if (parent && parent.setLayout) {
                parent.setLayout(LayoutType.OneColumn);
            }
        },

        formatCustomerName(firstName, lastName) {
            return formatter.formatCustomerName(firstName, lastName);
        },

        formatStatusState(status) {
            return formatter.formatStatusState(status);
        },

        formatOrderType(type) {
            return formatter.formatOrderType(type);
        },

        formatDate(value) {
            return formatter.formatDate(value);
        },

        formatAmount(value) {
            return formatter.formatAmount(value);
        },

        calculateItemTotal(quantity, unitPrice) {
            return formatter.calculateItemTotal(quantity, unitPrice);
        },

        calculateOrderTotal(items) {
            return formatter.calculateOrderTotal(items);
        },

        onExportPdf() {
            if (this._exportPdf) {
                this._exportPdf.download();
            }
        },

        onProceedToPayment() {
            const overviewModel = this.getView().getModel("overview");
            const orderId = overviewModel && overviewModel.getProperty("/id");
            if (!orderId) {
                MessageToast.show("Select an order before proceeding to payment.");
                return;
            }
            const targetHash = `#/payment/${encodeURIComponent(orderId)}`;
            const baseUrl = window.location.href.split("#")[0];
            window.open(`${baseUrl}${targetHash}`, "_blank");
        },

        onOpenCustomerDetails() {
            if (this._customerDialog) {
                this._customerDialog.open();
            }
        },

        onCloseCustomerDetails() {
            if (this._customerDialog) {
                this._customerDialog.close();
            }
        },

        onToggleCustomerEdit() {
            if (this._customerDialog) {
                this._customerDialog.toggleEditable();
            }
        },

        onCustomerCountryChange(event) {
            if (this._customerDialog) {
                this._customerDialog.handleCountryChange(event);
            }
        }
    });
});
