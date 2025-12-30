sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "artistmanagement/model/formatter"
], (Fragment, JSONModel, MessageToast, Filter, FilterOperator, formatter) => {
    "use strict";

    const getPerformanceModel = (controller) => {
        if (!controller._performanceModel) {
            controller._performanceModel = new JSONModel({
            artistId: "",
            performances: [],
            deletedIds: [],
            options: {
                stages: [],
                festivalDays: []
            }
        });
    }
    return controller._performanceModel;
};

    const getPerformanceDialog = (controller) => {
        if (!controller._performanceDialogPromise) {
            controller._performanceDialogPromise = Fragment.load({
                id: controller.getView().getId(),
                name: "artistmanagement.fragments.ManagePerformances",
                controller
            }).then((dialog) => {
                dialog.setModel(getPerformanceModel(controller), "performanceModel");
                dialog.setModel(controller.getView().getModel("detail"), "detail");
                controller.getView().addDependent(dialog);
                return dialog;
            });
        }
        return controller._performanceDialogPromise;
    };

    const getEmptyPerformanceRow = () => ({
        id: "",
        stageId: "",
        stageName: "",
        dayId: "",
        dayLabel: "",
        startTime: "",
        endTime: "",
        original: null,
        errors: {
            stageId: "",
            dayId: "",
            startTime: "",
            endTime: "",
            timeRange: ""
        }
    });

    const normalizeTime = (value) => {
        if (!value) {
            return "";
        }
        if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
            return value;
        }
        if (/^\d{2}:\d{2}$/.test(value)) {
            return `${value}:00`;
        }
        return value;
    };

    const timeToMinutes = (value) => {
        const normalized = normalizeTime(value);
        const [hours, minutes] = (normalized || "").split(":").map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return NaN;
        }
        return (hours * 60) + minutes;
    };

    const validatePerformanceForm = (controller) => {
        const perfModel = getPerformanceModel(controller);
        const rows = perfModel.getProperty("/performances") || [];
        let valid = true;
        rows.forEach((row, index) => {
            const errors = {
                stageId: row.stageId ? "" : "Choose a stage",
                dayId: row.dayId ? "" : "Select a day",
                startTime: row.startTime ? "" : "Select a start time",
                endTime: row.endTime ? "" : "Select an end time",
                timeRange: ""
            };
            if (row.startTime && row.endTime) {
                const startMinutes = timeToMinutes(row.startTime);
                const endMinutes = timeToMinutes(row.endTime);
                if (!Number.isNaN(startMinutes) && !Number.isNaN(endMinutes) && startMinutes >= endMinutes) {
                    errors.timeRange = "End time must be after start time";
                }
            }
            perfModel.setProperty(`/performances/${index}/errors`, errors);
            if (errors.stageId || errors.dayId || errors.startTime || errors.endTime || errors.timeRange) {
                valid = false;
            }
        });
        return valid;
    };

    const loadStageOptions = (controller) => {
        const oDataModel = controller.getView().getModel();
        if (!oDataModel) {
            return Promise.resolve();
        }
        const binding = oDataModel.bindList("/Stages", undefined, undefined, undefined, {
            $select: "ID,name"
        });
        return binding.requestContexts(0, 200).then((contexts) => {
            const stages = contexts.map((ctx) => ({
                key: ctx.getProperty("ID") || "",
                text: ctx.getProperty("name") || ""
            }));
            getPerformanceModel(controller).setProperty("/options/stages", stages);
        }).catch(() => {
            getPerformanceModel(controller).setProperty("/options/stages", []);
        });
    };

    const loadFestivalDayOptions = (controller) => {
        const oDataModel = controller.getView().getModel();
        if (!oDataModel) {
            return Promise.resolve();
        }
        const binding = oDataModel.bindList("/FestivalDays", undefined, undefined, undefined, {
            $select: "ID,dayNumber,date"
        });
        return binding.requestContexts(0, 200).then((contexts) => {
            const days = contexts.map((ctx) => ({
                key: ctx.getProperty("ID") || "",
                text: formatter.formatFestivalDay(ctx.getProperty("dayNumber"), ctx.getProperty("date"))
            }));
            getPerformanceModel(controller).setProperty("/options/festivalDays", days);
        }).catch(() => {
            getPerformanceModel(controller).setProperty("/options/festivalDays", []);
        });
    };

    const fetchPerformances = (controller, artistId) => {
        const oDataModel = controller.getView().getModel();
        if (!oDataModel) {
            return Promise.resolve([]);
        }
        const binding = oDataModel.bindList("/Performances", undefined, undefined, [
            new Filter("artist/ID", FilterOperator.EQ, artistId)
        ], {
            $select: "ID,startTime,endTime,stage_ID,day_ID",
            $expand: "stage($select=ID,name),day($select=ID,dayNumber,date)"
        });
        return binding.requestContexts(0, 200).then((contexts) => {
            const performances = contexts.map((ctx) => {
                const perf = ctx.getObject();
                return {
                    id: perf.ID || perf.id || "",
                    startTime: perf.startTime,
                    endTime: perf.endTime,
                    stageId: perf.stage_ID || (perf.stage && perf.stage.ID) || "",
                    stageName: (perf.stage && perf.stage.name) || "",
                    dayId: perf.day_ID || (perf.day && perf.day.ID) || "",
                    dayNumber: perf.day && perf.day.dayNumber,
                    dayLabel: formatter.formatFestivalDay(perf.day && perf.day.dayNumber, perf.day && perf.day.date),
                    dayDate: perf.day && perf.day.date
                };
            });
            performances.sort((a, b) => {
                if (a.dayNumber && b.dayNumber && a.dayNumber !== b.dayNumber) {
                    return a.dayNumber - b.dayNumber;
                }
                const aStart = timeToMinutes(a.startTime);
                const bStart = timeToMinutes(b.startTime);
                if (!Number.isNaN(aStart) && !Number.isNaN(bStart)) {
                    return aStart - bStart;
                }
                return 0;
            });
            return performances;
        }).catch(() => []);
    };

    const mapPerformanceToForm = (perf) => {
        const startTime = normalizeTime(perf.startTime || "");
        const endTime = normalizeTime(perf.endTime || "");
        return {
            id: perf.id || "",
            stageId: perf.stageId || "",
            stageName: perf.stageName || "",
            dayId: perf.dayId || "",
            dayLabel: perf.dayLabel || "",
            dayNumber: perf.dayNumber,
            startTime,
            endTime,
            original: {
                stageId: perf.stageId || "",
                dayId: perf.dayId || "",
                startTime,
                endTime
            },
            errors: {
                stageId: "",
                dayId: "",
                startTime: "",
                endTime: "",
                timeRange: ""
            }
        };
    };

    const loadPerformancesForEditing = (controller, artistId) => fetchPerformances(controller, artistId).then((performances) => {
        const rows = performances.map((perf) => mapPerformanceToForm(perf));
        const perfModel = getPerformanceModel(controller);
        perfModel.setProperty("/performances", rows);
        perfModel.setProperty("/deletedIds", []);
        setDetailPerformances(controller, performances);
        return performances;
    });

    const setDetailPerformances = (controller, performances) => {
        const detailModel = controller.getView().getModel("detail");
        if (!detailModel) {
            return;
        }
        detailModel.setProperty("/performances", performances.map((perf) => ({
            id: perf.id,
            startTime: perf.startTime,
            endTime: perf.endTime,
            dayId: perf.dayId,
            dayLabel: perf.dayLabel,
            dayDate: perf.dayDate,
            dayNumber: perf.dayNumber,
            stageName: perf.stageName || findStageName(controller, perf.stageId),
            stageId: perf.stageId
        })));
    };

    const findStageName = (controller, stageId) => {
        const stages = (controller._performanceModel && controller._performanceModel.getProperty("/options/stages")) || [];
        const match = stages.find((s) => s.key === stageId);
        return (match && match.text) || "";
    };

    const deletePerformance = (controller, performanceId) => {
        if (!performanceId) {
            return Promise.resolve();
        }
        const oDataModel = controller.getView().getModel();
        const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
        const url = `${serviceUrl}/Performances('${performanceId}')`;
        return fetch(url, {
            method: "DELETE"
        }).then((res) => {
            if (!res.ok) {
                throw new Error(`Delete failed ${res.status}`);
            }
        });
    };

    const updatePerformance = (controller, perf) => {
        if (!perf || !perf.id) {
            return Promise.resolve();
        }
        const original = perf.original || {};
        if (original.stageId === perf.stageId && original.dayId === perf.dayId && original.startTime === perf.startTime && original.endTime === perf.endTime) {
            return Promise.resolve();
        }
        const payload = {
            startTime: normalizeTime(perf.startTime),
            endTime: normalizeTime(perf.endTime),
            stage_ID: perf.stageId,
            day_ID: perf.dayId
        };
        const oDataModel = controller.getView().getModel();
        const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
        const url = `${serviceUrl}/Performances('${perf.id}')`;
        return fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then((res) => {
            if (!res.ok) {
                throw new Error(`Update failed ${res.status}`);
            }
        });
    };

    const createPerformance = (controller, perf, artistId) => {
        if (!perf || !artistId) {
            return Promise.resolve();
        }
        const payload = {
            startTime: normalizeTime(perf.startTime),
            endTime: normalizeTime(perf.endTime),
            stage_ID: perf.stageId,
            day_ID: perf.dayId,
            artist_ID: artistId
        };
        const oDataModel = controller.getView().getModel();
        const listBinding = oDataModel.bindList("/Performances");
        const context = listBinding.create(payload);
        return context.created().then(() => context.requestObject()).then((created) => created).catch((err) => {
            throw err;
        });
    };

    const refreshReviews = (controller, artistId) => {
        const detailModel = controller.getView().getModel("detail");
        if (!artistId) {
            return Promise.resolve();
        }
        const oDataModel = controller.getView().getModel();
        const reviewsBinding = oDataModel.bindList("/Reviews", undefined, undefined, [
            new Filter("performance/artist/ID", FilterOperator.EQ, artistId)
        ], {
            $select: "ID,rating,date,comment,customerName"
        });
        return reviewsBinding.requestContexts(0, 200).then((contexts) => {
            const reviews = contexts.map((ctx) => {
                const review = ctx.getObject();
                return {
                    id: review.ID || review.id || "",
                    rating: review.rating,
                    comment: review.comment,
                    date: review.date,
                    customerName: review.customerName
                };
            });
            reviews.sort((a, b) => {
                const aDate = a.date ? new Date(a.date).getTime() : 0;
                const bDate = b.date ? new Date(b.date).getTime() : 0;
                return bDate - aDate;
            });
            if (detailModel) {
                detailModel.setProperty("/reviews", reviews);
            }
            if (controller._updatePopularityFromReviews) {
                controller._updatePopularityFromReviews(reviews);
            }
            return reviews;
        }).catch(() => {
            if (detailModel) {
                detailModel.setProperty("/reviews", []);
            }
            if (controller._updatePopularityFromReviews) {
                controller._updatePopularityFromReviews([]);
            }
            return [];
        });
    };

    const refreshPerformancesAfterSave = (controller, artistId) => fetchPerformances(controller, artistId).then((performances) => {
        setDetailPerformances(controller, performances);
        return refreshReviews(controller, artistId);
    }).then(() => {
        sap.ui.getCore().getEventBus().publish("artist", "updated", { id: artistId });
    });

    const openManagePerformances = (controller) => {
        const detailModel = controller.getView().getModel("detail");
        const artistId = detailModel && detailModel.getProperty("/id");
        if (!artistId) {
            MessageToast.show("Select an artist first.");
            return;
        }
        const perfModel = getPerformanceModel(controller);
        perfModel.setData({
            artistId,
            performances: [],
            deletedIds: [],
            options: { stages: [], festivalDays: [] }
        });
        Promise.all([loadStageOptions(controller), loadFestivalDayOptions(controller), loadPerformancesForEditing(controller, artistId)]).then(() => {
            validatePerformanceForm(controller);
            return getPerformanceDialog(controller);
        }).then((dialog) => dialog.open()).catch((err) => {
            MessageToast.show("Unable to load performances.");
            // eslint-disable-next-line no-console
            console.error("Load performances failed", err);
        });
    };

    const addPerformanceRow = (controller) => {
        const perfModel = getPerformanceModel(controller);
        const rows = perfModel.getProperty("/performances") || [];
        rows.push(getEmptyPerformanceRow());
        perfModel.setProperty("/performances", rows);
        validatePerformanceForm(controller);
    };

    const removePerformanceRow = (controller, event) => {
        const context = event.getSource().getBindingContext("performanceModel");
        if (!context) {
            return;
        }
        const path = context.getPath();
        const index = Number(path.split("/").pop());
        const perfModel = getPerformanceModel(controller);
        const rows = perfModel.getProperty("/performances") || [];
        const deletedIds = perfModel.getProperty("/deletedIds") || [];
        const removed = rows.splice(index, 1)[0];
        if (removed && removed.id) {
            deletedIds.push(removed.id);
        }
        perfModel.setProperty("/performances", rows);
        perfModel.setProperty("/deletedIds", deletedIds);
        validatePerformanceForm(controller);
    };

    const managePerformanceFieldChange = (controller) => {
        validatePerformanceForm(controller);
    };

    const cancelManagePerformances = (controller) => getPerformanceDialog(controller).then((dialog) => dialog.close());

    const saveManagePerformances = (controller) => {
        const perfModel = getPerformanceModel(controller);
        const data = perfModel.getData();
        if (!validatePerformanceForm(controller)) {
            MessageToast.show("Fix the performance details.");
            return;
        }
        const dialogPromise = getPerformanceDialog(controller);
        dialogPromise.then((dialog) => dialog.setBusy(true));
        const operations = [];
        (data.deletedIds || []).forEach((id) => {
            operations.push(() => deletePerformance(controller, id));
        });
        (data.performances || []).forEach((perf) => {
            if (perf.id) {
                operations.push(() => updatePerformance(controller, perf));
            } else {
                operations.push(() => createPerformance(controller, perf, data.artistId));
            }
        });
        operations.reduce((prev, op) => prev.then(() => op()), Promise.resolve()).then(() => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            dialogPromise.then((dialog) => dialog.close());
            return refreshPerformancesAfterSave(controller, data.artistId);
        }).then(() => {
            MessageToast.show("Performances updated");
        }).catch((err) => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            MessageToast.show("Could not save performances");
            // eslint-disable-next-line no-console
            console.error("Manage performances failed", err);
        });
    };

    return {
        openManagePerformances,
        addPerformanceRow,
        removePerformanceRow,
        managePerformanceFieldChange,
        cancelManagePerformances,
        saveManagePerformances,
        getPerformanceModel,
        getEmptyPerformanceRow
    };
});
