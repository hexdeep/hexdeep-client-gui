if (!window["ENV"]) {
    setTimeout(() => {
        document.write("Config is not loaded");
    }, 1000);
}

export const Config = {
    title: ENV.VITE_APP_TITLE as string,
    host: ENV.VITE_APP_HOST as string,
};