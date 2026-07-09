/**
 * FitToScreen — shared viewport-fit kit for scaled-canvas web apps.
 * Sizes the stage to the visible viewport, waits for stability at open,
 * and avoids the scale(1) remeasure flash that causes shrink-on-open on iOS.
 */
(function (root) {
  "use strict";

  function resolveEl(elOrId) {
    if (!elOrId) return null;
    if (typeof elOrId === "string") return document.getElementById(elOrId);
    return elOrId;
  }

  function create(options) {
    const {
      stage: stageOpt = "fit-stage",
      app: appOpt = "app",
      phoneMaxWidth = 767,
      wideAppWidth = 560,
      phoneTopBuffer = 0,
      scaleEpsilon = 0.008,
      settleMaxMs = 600,
      settleStableFrames = 4,
      resizeGraceMs = 350,
      capScaleAtOne = true,
      shouldFit = () => true,
      getTopBuffer,
      getAppLayoutWidth,
      getCapScaleAtOne,
      getLayoutName,
      useScaleForLayout,
      onFit = () => {},
    } = options || {};

    const topBufferFor =
      getTopBuffer || ((layout) => (layout === "phone" ? phoneTopBuffer : 0));

    let stage = null;
    let app = null;
    let fitFrame = 0;
    let fitNaturalH = 0;
    let fitNaturalW = 0;
    let fitAvailH = 0;
    let fitAvailW = 0;
    let fitLayout = "";
    let appliedScale = 0;
    let layoutReady = false;
    let layoutShownAt = 0;
    let listenersBound = false;

    function ensureElements() {
      if (!stage) stage = resolveEl(stageOpt);
      if (!app) app = resolveEl(appOpt);
      return stage && app;
    }

    function isPhoneLayout(availW) {
      return availW <= phoneMaxWidth;
    }

    function layoutFor(availW, availH) {
      if (getLayoutName) return getLayoutName(availW, availH);
      return isPhoneLayout(availW) ? "phone" : "wide";
    }

    function appLayoutWidth(availW, availH) {
      const layout = layoutFor(availW, availH);
      if (getAppLayoutWidth) {
        const custom = getAppLayoutWidth(availW, layout, availH);
        if (custom != null) return custom;
      }
      return isPhoneLayout(availW) ? availW : wideAppWidth;
    }

    function syncFitStageViewport() {
      if (!ensureElements()) return;
      const vv = root.visualViewport;
      if (!vv || !isPhoneLayout(root.innerWidth)) {
        stage.style.top = "";
        stage.style.left = "";
        stage.style.width = "";
        stage.style.height = "";
        return;
      }
      stage.style.top = `${vv.offsetTop}px`;
      stage.style.left = `${vv.offsetLeft}px`;
      stage.style.width = `${vv.width}px`;
      stage.style.height = `${vv.height}px`;
    }

    function viewportSizeMatchesFit() {
      if (!ensureElements() || !layoutReady) return false;
      syncFitStageViewport();
      return stage.clientHeight === fitAvailH && stage.clientWidth === fitAvailW;
    }

    function shouldScaleLayout(layout, availW, availH) {
      if (typeof useScaleForLayout === "function") {
        return useScaleForLayout(layout, availW, availH);
      }
      return isPhoneLayout(availW);
    }

    function applyFluidLayout(layout) {
      stage.classList.add("fit-stage--fluid");
      app.dataset.layout = layout;
      app.style.width = "";
      app.style.maxWidth = "";
      app.style.transform = "none";
      fitLayout = layout;
      fitAvailH = stage.clientHeight;
      fitAvailW = stage.clientWidth;
      appliedScale = 1;
      if (!app.classList.contains("is-fitted")) {
        layoutShownAt = performance.now();
      }
      app.classList.add("is-fitted");
      layoutReady = true;
      onFit({ scale: 1, layout, availH: fitAvailH, availW: fitAvailW, fluid: true });
    }

    function measureNaturalSize() {
      // Layout size ignores CSS transform, so no scale(1) flash needed.
      fitNaturalH = app.offsetHeight;
      fitNaturalW = app.offsetWidth;
    }

    function fitToScreen(remasure = false) {
      if (!ensureElements() || !shouldFit()) return;

      syncFitStageViewport();

      const availH = stage.clientHeight;
      const availW = stage.clientWidth;
      const viewportChanged = availH !== fitAvailH || availW !== fitAvailW;
      const layout = layoutFor(availW, availH);
      const layoutChanged = layout !== fitLayout;

      if (!shouldScaleLayout(layout, availW, availH)) {
        if (
          layoutReady &&
          app.classList.contains("is-fitted") &&
          layout === fitLayout &&
          stage.classList.contains("fit-stage--fluid") &&
          !viewportChanged &&
          !remasure
        ) {
          return;
        }
        applyFluidLayout(layout);
        return;
      }

      stage.classList.remove("fit-stage--fluid");
      app.style.width = `${appLayoutWidth(availW, availH)}px`;
      app.dataset.layout = layout;

      if (remasure || viewportChanged || layoutChanged || !fitNaturalH) {
        measureNaturalSize();
        fitAvailH = availH;
        fitAvailW = availW;
        fitLayout = layout;
      }

      if (!fitNaturalH || !fitNaturalW) return;

      const buffer = topBufferFor(layout);
      // Height-first: fill the stage vertically. Only yield to width when it
      // would overflow by more than 2px (avoids tiny width errors leaving a
      // large empty bottom strip).
      const heightRoom = Math.max(1, availH - buffer);
      const widthRoom = Math.max(1, availW);
      const capAtOne = getCapScaleAtOne
        ? getCapScaleAtOne(layout, availW, availH)
        : capScaleAtOne;
      let scale = heightRoom / fitNaturalH;
      if (capAtOne) scale = Math.min(scale, 1);
      if (fitNaturalW * scale > widthRoom + 2) {
        scale = widthRoom / fitNaturalW;
        if (capAtOne) scale = Math.min(scale, 1);
      }

      app.style.transform = `scale(${scale})`;

      // Soft height clamp if paint still spills (stale natural size / wrap).
      const painted = app.getBoundingClientRect();
      if (painted.height > heightRoom + 2) {
        scale = Math.max(0.05, scale * (heightRoom / painted.height));
        if (capAtOne) scale = Math.min(scale, 1);
        app.style.transform = `scale(${scale})`;
      }

      if (
        layoutReady &&
        app.classList.contains("is-fitted") &&
        Math.abs(scale - appliedScale) < scaleEpsilon
      ) {
        appliedScale = scale;
        return;
      }

      appliedScale = scale;
      if (!app.classList.contains("is-fitted")) {
        layoutShownAt = performance.now();
      }
      app.classList.add("is-fitted");
      layoutReady = true;
      onFit({ scale, layout, availH, availW });
    }

    function scheduleFitToScreen(remasure = false) {
      if (!remasure && viewportSizeMatchesFit()) return;
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => fitToScreen(remasure));
    }

    function settleViewport() {
      if (!ensureElements()) return Promise.resolve();

      let stable = 0;
      let lastW = -1;
      let lastH = -1;
      const start = performance.now();

      return new Promise((resolve) => {
        function tick() {
          syncFitStageViewport();
          const w = stage.clientWidth;
          const h = stage.clientHeight;

          if (w > 0 && h > 0 && w === lastW && h === lastH) {
            stable += 1;
            if (stable >= settleStableFrames) {
              resolve();
              return;
            }
          } else {
            stable = 0;
            lastW = w;
            lastH = h;
          }

          if (performance.now() - start >= settleMaxMs) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    }

    async function bootLayout() {
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch (_) {}
      }
      await settleViewport();
      fitToScreen(true);
    }

    function resetNaturalSize() {
      fitNaturalH = 0;
      fitNaturalW = 0;
    }

    function onViewportResize() {
      if (!layoutReady) return;
      if (performance.now() - layoutShownAt < resizeGraceMs) return;
      scheduleFitToScreen(true);
    }

    function onOrientationChange() {
      scheduleFitToScreen(true);
    }

    function bindViewportListeners(options = {}) {
      if (listenersBound) return;
      listenersBound = true;
      const bindOrientation = options.bindOrientation !== false;
      root.addEventListener("resize", onViewportResize);
      if (bindOrientation) root.addEventListener("orientationchange", onOrientationChange);
      root.visualViewport?.addEventListener("resize", onViewportResize);
    }

    return {
      syncFitStageViewport,
      fitToScreen,
      scheduleFitToScreen,
      settleViewport,
      bootLayout,
      resetNaturalSize,
      bindViewportListeners,
      isLayoutReady: () => layoutReady,
      getAppliedScale: () => appliedScale,
    };
  }

  root.FitToScreen = { create };
})(typeof window !== "undefined" ? window : globalThis);