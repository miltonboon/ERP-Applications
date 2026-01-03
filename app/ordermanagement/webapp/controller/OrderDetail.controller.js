sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "ordermanagement/ordermanagement/model/formatter",
    "ordermanagement/ordermanagement/controller/util/CustomerDialog",
    "ordermanagement/ordermanagement/controller/util/ExportPDF"
], (Controller, fLibrary, MessageToast, MessageBox, formatter, CustomerDialog, ExportPDF) => {
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

        async onCancelOrder() {
            const view = this.getView();
            const elementBinding = view && view.getElementBinding && view.getElementBinding();
            const context = elementBinding && elementBinding.getBoundContext && elementBinding.getBoundContext();
            if (!context || !context.setProperty) {
                MessageToast.show("Select an order before cancelling.");
                return;
            }
            const currentStatus = context.getProperty("status");
            if (currentStatus === "Cancelled") {
                MessageToast.show("Order is already cancelled.");
                return;
            }
            MessageBox.confirm("Are you sure you want to cancel this order?", {
                title: "Cancel Order",
                actions: [MessageBox.Action.YES, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.YES,
                onClose: async (action) => {
                    if (action !== MessageBox.Action.YES) {
                        return;
                    }
                    const mainModel = this.getOwnerComponent().getModel();
                    const overviewModel = view.getModel("overview");
                    const orderId = overviewModel && overviewModel.getProperty("/id");
                    const updateGroupId = this._getUpdateGroupId(mainModel);
                    let orderItems = [];
                    try {
                        orderItems = await this._loadOrderItemsForRestock(orderId, context);
                    } catch (_e) {
                        MessageToast.show("Could not load order items to restock.");
                        return;
                    }
                    let restockOperations = [];
                    try {
                        restockOperations = await this._prepareRestockOperations(orderItems, updateGroupId);
                    } catch (_e) {
                    MessageToast.show("Could not prepare stock update.");
                    return;
                }
                if (!restockOperations || restockOperations.length === 0) {
                    MessageToast.show("No items to restock for this order.");
                    return;
                }
                /* Debug log for restock payload */
                // eslint-disable-next-line no-console
                console.log("Restock operations", restockOperations);
                    context.setProperty("status", "Cancelled", updateGroupId);
                    try {
                        this._applyRestockOperations(restockOperations);
                        await mainModel.submitBatch(updateGroupId);
                        const overviewModel = view.getModel("overview");
                        if (overviewModel) {
                            overviewModel.setProperty("/status", "Cancelled");
                        }
                        if (mainModel && mainModel.refresh) {
                            mainModel.refresh();
                        }
                        MessageToast.show("Order cancelled and stock restored.");
                    } catch (_e) {
                        this._revertRestockOperations(restockOperations);
                        context.setProperty("status", currentStatus);
                        MessageToast.show("Failed to cancel order.");
                    }
                }
            });
        },

        async _loadOrderItemsForRestock(orderId, context) {
            const mainModel = this.getOwnerComponent().getModel();
            const path = orderId ? `/Orders('${orderId}')/items` : `${context.getPath()}/items`;
            const binding = mainModel.bindList(path, undefined, undefined, undefined, {
                $expand: "item($select=ID,stock)"
            });
            const contexts = await binding.requestContexts(0, 200);
            return contexts.map((ctx) => ctx.getObject());
        },

        async _prepareRestockOperations(orderItems, updateGroupId) {
            if (!Array.isArray(orderItems) || orderItems.length === 0) {
                return [];
            }
            const mainModel = this.getOwnerComponent().getModel();
            const quantities = new Map();
            orderItems.forEach((orderItem) => {
                const itemData = orderItem ? (orderItem.item || {}) : {};
                const itemId = orderItem.item_ID || itemData.ID || itemData.Id || itemData.id || orderItem.itemId || orderItem.item_id;
                const quantity = Number(orderItem.quantity);
                if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
                    return;
                }
                const current = quantities.get(itemId) || 0;
                quantities.set(itemId, current + quantity);
            });
            /* Debug log quantities per item */
            // eslint-disable-next-line no-console
            console.log("Quantities to restock", Array.from(quantities.entries()));
            const operations = [];
            for (const [itemId, quantity] of quantities.entries()) {
                const itemContext = mainModel.bindContext(`/Items('${itemId}')`, undefined, {
                    $$updateGroupId: updateGroupId || "$auto"
                });
                const data = await (itemContext.requestObject ? itemContext.requestObject() : Promise.resolve({}));
                const stockFromItem = data && data.stock;
                const currentStock = Number(stockFromItem);
                const previousStock = Number.isFinite(currentStock) ? currentStock : 0;
                operations.push({
                    context: itemContext,
                    previousStock,
                    nextStock: previousStock + quantity,
                    groupId: updateGroupId || "$auto"
                });
            }
            return operations;
        },

        _applyRestockOperations(operations) {
            operations.forEach((op) => {
                if (op && op.context && op.context.setProperty) {
                    op.context.setProperty("stock", op.nextStock, op.groupId);
                }
            });
        },

        _revertRestockOperations(operations) {
            operations.forEach((op) => {
                if (op && op.context && op.context.setProperty) {
                    op.context.setProperty("stock", op.previousStock, op.groupId || "$auto");
                }
            });
        },

        _getUpdateGroupId(mainModel) {
            if (mainModel && typeof mainModel.getUpdateGroupId === "function") {
                return mainModel.getUpdateGroupId();
            }
            return "$auto";
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
