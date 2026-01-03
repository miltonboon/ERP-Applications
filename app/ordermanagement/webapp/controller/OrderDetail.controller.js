sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, fLibrary, Fragment, JSONModel, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;
    const statusColorMap = {
        Submitted: [11, 98, 179],
        Paid: [16, 126, 62],
        Cancelled: [204, 0, 0],
        Draft: [120, 120, 120]
    };

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

        onExportPdf() {
            const view = this.getView();
            const context = view && view.getBindingContext();
            if (!context) {
                return;
            }
            const data = context.getObject() || {};
            const overview = view.getModel("overview") ? view.getModel("overview").getData() : {};
            this._loadJsPdf().then((jsPDF) => {
                const doc = new jsPDF();
                const customer = data.customer || {};
                const items = Array.isArray(data.items) ? data.items : [];
                const status = data.status || overview.status || "";
                const orderDate = data.date || overview.date || "";
                let y = 14;
                doc.setFontSize(16);
                doc.setTextColor(200, 0, 0);
                doc.text("AP", 14, y);
                doc.setTextColor(0, 0, 0);
                const apWidth = doc.getTextWidth("AP") + 1;
                doc.text("Morrowland Invoice", 14 + apWidth, y);
                const statusColor = statusColorMap[status] || [60, 60, 60];
                doc.setFontSize(12);
                doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
                doc.text(status || "", 190, y, { align: "right" });
                doc.setTextColor(0, 0, 0);
                y += 8;
                doc.setFontSize(11);
                doc.text(`Order ID: ${data.ID || ""}`, 14, y); y += 6;
                doc.text(`Order Date: ${this.formatDate(orderDate)}`, 14, y); y += 6;
                y += 4;
                doc.setFontSize(12);
                doc.setFont(undefined, "bold");
                doc.text("Customer", 14, y);
                doc.setFont(undefined, "normal");
                y += 6;
                doc.setFontSize(10);
                doc.text(`${this.formatCustomerName(customer.firstName, customer.lastName)}`, 14, y); y += 5;
                if (customer.email) { doc.text(`Email: ${customer.email}`, 14, y); y += 5; }
                if (customer.phone) { doc.text(`Phone: ${customer.phone}`, 14, y); y += 5; }
                if (customer.address) { doc.text(`Address: ${customer.address}`, 14, y); y += 5; }
                if (customer.postalCode) { doc.text(`Postal Code: ${customer.postalCode}`, 14, y); y += 5; }
                if (customer.country && customer.country.name) { doc.text(`Country: ${customer.country.name}`, 14, y); y += 6; }
                y += 2;
                doc.setFontSize(12);
                doc.setFont(undefined, "bold");
                doc.text("Order Items", 14, y);
                doc.setFont(undefined, "normal");
                y += 6;
                doc.setFontSize(10);
                doc.text("Item", 14, y);
                doc.text("Qty", 110, y);
                doc.text("Unit", 130, y);
                doc.text("Total", 170, y);
                y += 4;
                doc.line(14, y, 190, y);
                y += 4;
                items.forEach((item) => {
                    const total = formatter.calculateItemTotal(item.quantity, item.unitPrice);
                    doc.text(item.item && item.item.name ? item.item.name : "", 14, y);
                    doc.text(String(item.quantity || 0), 110, y);
                    doc.text(`${formatter.formatAmount(item.unitPrice || 0)} EUR`, 130, y);
                    doc.text(`${total} EUR`, 170, y);
                    y += 6;
                });
                y += 2;
                doc.line(14, y, 190, y);
                y += 6;
                const computedTotal = formatter.calculateOrderTotal(items);
                doc.setFontSize(11);
                doc.text(`Order Total: ${computedTotal} EUR`, 190, y, { align: "right" });
                const fileName = data.ID ? `Invoice_${data.ID}.pdf` : "Invoice.pdf";
                doc.save(fileName);
            }).catch(() => {});
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
        },

        onCustomerCountryChange(event) {
            const source = event.getSource();
            const context = source && source.getBindingContext();
            if (context && context.requestSideEffects) {
                context.requestSideEffects([{ $NavigationPropertyPath: "customer/country" }]).catch(() => {});
            }
        },

        _loadJsPdf() {
            if (this._jsPdfPromise) {
                return this._jsPdfPromise;
            }
            this._jsPdfPromise = new Promise((resolve, reject) => {
                if (window.jspdf && window.jspdf.jsPDF) {
                    resolve(window.jspdf.jsPDF);
                    return;
                }
                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
                script.onload = () => {
                    if (window.jspdf && window.jspdf.jsPDF) {
                        resolve(window.jspdf.jsPDF);
                    } else {
                        reject();
                    }
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
            return this._jsPdfPromise;
        }
    });
});
