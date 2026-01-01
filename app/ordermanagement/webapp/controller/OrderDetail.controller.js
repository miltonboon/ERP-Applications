sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, fLibrary, Fragment, JSONModel, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderDetail", {
        formatter,
        _getCustomerDialogModel() {
            if (!this._customerDialogModel) {
                this._customerDialogModel = new JSONModel({
                    editable: false
                });
            }
            return this._customerDialogModel;
        },

        onExit() {
            if (this._customerDialogPromise) {
                this._customerDialogPromise.then((dialog) => dialog.destroy());
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

        onOpenCustomerDetails() {
            if (!this._customerDialogPromise) {
                this._customerDialogPromise = Fragment.load({
                    name: "ordermanagement.ordermanagement.fragment.CustomerDetails",
                    controller: this
                }).then((dialog) => {
                    this.getView().addDependent(dialog);
                    dialog.setModel(this._getCustomerDialogModel(), "customerDialog");
                    return dialog;
                });
            }
            this._customerDialogPromise.then((dialog) => {
                this._getCustomerDialogModel().setProperty("/editable", false);
                dialog.setBindingContext(this.getView().getBindingContext());
                dialog.open();
            });
        },

        onCloseCustomerDetails() {
            if (this._customerDialogPromise) {
                this._customerDialogPromise.then((dialog) => dialog.close());
            }
        },

        onToggleCustomerEdit() {
            const model = this._getCustomerDialogModel();
            const editable = !!model.getProperty("/editable");
            model.setProperty("/editable", !editable);
        }
    });
});
