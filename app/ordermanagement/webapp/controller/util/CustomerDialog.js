sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment"
], (JSONModel, Fragment) => {
    "use strict";

    class CustomerDialog {
        constructor(controller) {
            this.controller = controller;
            this._customerDialogModel = null;
            this._customerDialogPromise = null;
        }

        destroy() {
            if (this._customerDialogPromise) {
                this._customerDialogPromise.then((dialog) => dialog.destroy());
            }
        }

        getModel() {
            if (!this._customerDialogModel) {
                this._customerDialogModel = new JSONModel({
                    editable: false
                });
            }
            return this._customerDialogModel;
        }

        async open() {
            if (!this._customerDialogPromise) {
                this._customerDialogPromise = Fragment.load({
                    name: "ordermanagement.ordermanagement.fragment.CustomerDetails",
                    controller: this.controller
                }).then((dialog) => {
                    this.controller.getView().addDependent(dialog);
                    dialog.setModel(this.getModel(), "customerDialog");
                    return dialog;
                });
            }
            this._customerDialogPromise.then((dialog) => {
                this.getModel().setProperty("/editable", false);
                dialog.setBindingContext(this.controller.getView().getBindingContext());
                dialog.open();
            });
        }

        close() {
            if (this._customerDialogPromise) {
                this._customerDialogPromise.then((dialog) => dialog.close());
            }
        }

        toggleEditable() {
            const model = this.getModel();
            const editable = !!model.getProperty("/editable");
            model.setProperty("/editable", !editable);
        }

        handleCountryChange(event) {
            const source = event.getSource();
            const context = source && source.getBindingContext();
            if (context && context.requestSideEffects) {
                context.requestSideEffects([{ $NavigationPropertyPath: "customer/country" }]).catch(() => {});
            }
        }
    }

    return CustomerDialog;
});
