sap.ui.define([
    "sap/ui/core/UIComponent",
    "leaderboardoverview/leaderboardoverview/model/models",
    "sap/ui/model/odata/v4/ODataModel"
], (UIComponent, models, ODataModel) => {
    "use strict";

    return UIComponent.extend("leaderboardoverview.leaderboardoverview.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");
            this.setModel(new ODataModel({
                serviceUrl: "/odata/v4/festival/",
                synchronizationMode: "None",
                operationMode: "Server",
                autoExpandSelect: true
            }));

            this.getRouter().initialize();
        }
    });
});
