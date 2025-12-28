sap.ui.define([], () => {
    "use strict";

    const downscaleAvatar = (dataUrl, quality = 0.85) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const maxSize = 256;
            let { width, height } = img;
            if (!width || !height) {
                reject();
                return;
            }
            if (width > height && width > maxSize) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
            } else if (height >= width && height > maxSize) {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject();
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const mimeType = "image/jpeg";
            const compressed = canvas.toDataURL(mimeType, quality);
            resolve({ dataUrl: compressed, mimeType });
        };
        img.onerror = () => reject();
        img.src = dataUrl;
    });

    const normalizeAvatar = (value) => {
        if (!value) {
            return "";
        }
        if (typeof value === "string") {
            if (value.startsWith("data:")) {
                const parts = value.split(",");
                return parts[1] || "";
            }
            return value;
        }
        return "";
    };

    return {
        downscaleAvatar,
        normalizeAvatar
    };
});
