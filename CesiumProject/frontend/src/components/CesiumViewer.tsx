import React, { useEffect, useRef } from 'react'
import { Viewer, Ion, UrlTemplateImageryProvider, Cartesian3, Color, JulianDate, SceneMode, Model, Resource } from 'cesium'

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      const loader = (window as any).loadGLB
      if (typeof loader === 'function') {
        try {
          await loader(file)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('loadGLB failed', err)
        }
      } else {
        // fallback: create object URL and call loadGLB if present
        try {
          const url = URL.createObjectURL(file)
          ;(window as any).loadGLB = (window as any).loadGLB || (() => {})
          try { await (window as any).loadGLB(url) } catch (err) { /* ignore */ }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed fallback loadGLB', err)
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('handleFileChange error', err)
    } finally {
      try { if (fileInputRef.current) fileInputRef.current.value = '' } catch (e) { /* ignore */ }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      scene3DOnly: true,
      baseLayerPicker: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      fullscreenButton: false,
      vrButton: true,
      geocoder: true,
      infoBox: true,
      selectionIndicator: true,
    })

    // expose viewer for debug
    try { (window as any).viewer = viewer } catch (e) { /* ignore */ }

    // ensure 3D
    try {
      if (viewer && viewer.scene && viewer.scene.morphTo3D) viewer.scene.morphTo3D(0)
    } catch (e) { /* ignore */ }

    // initial camera
    try {
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(113.5535, 22.1216, 5000),
        orientation: { heading: 0.0, pitch: -Math.PI / 6, roll: 0.0 }
      })
    } catch (e) { /* ignore */ }

    // imagery
    try {
      const esriUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      const satProvider = new UrlTemplateImageryProvider({ url: esriUrl, credit: 'Esri World Imagery' })
      viewer.imageryLayers.removeAll()
      viewer.imageryLayers.addImageryProvider(satProvider)
    } catch (e) { /* ignore */ }

    // Hide Cesium credits/logo and optional geocoder UI elements. We attempt
    // multiple strategies for different Cesium builds and fall back to
    // querying DOM nodes under the containerRef.
    try {
      let postRenderHideHandler: any = undefined

      const hideCesiumUI = () => {
        try {
          // private widget references used in some Cesium versions
          const cw = (viewer as any)?._cesiumWidget
          const creditCandidates = [
            cw && cw._creditContainer,
            cw && cw._creditContainerElement,
            cw && cw._creditsContainer,
            // some builds use _creditContainer as HTMLElement
            (cw && (cw._creditContainerElement || cw._creditsContainer || cw._creditContainer))
          ].filter(Boolean)

          creditCandidates.forEach((c: any) => {
            try {
              if (c && c.style) {
                c.style.display = 'none'
                c.style.visibility = 'hidden'
                c.style.pointerEvents = 'none'
              }
            } catch (e) { /* ignore */ }
          })

          // hide viewer.geocoder container if present
          try {
            const geocoder = (viewer as any).geocoder
            if (geocoder && geocoder.container && geocoder.container.style) {
              geocoder.container.style.display = 'none'
              geocoder.container.style.visibility = 'hidden'
              geocoder.container.style.pointerEvents = 'none'
            }
          } catch (e) { /* ignore */ }

          // also attempt to hide by CSS class selectors inside the viewer container
          if (containerRef.current) {
            const els = containerRef.current.querySelectorAll(
              '.cesium-credit, .cesium-credit-container, .cesium-creditContainer, .cesium-credit-logo, .cesium-credit-image, .cesium-credit-text, .cesium-credits, .cesium-geocoder, .cesium-geocoder-container, .cesium-search, .cesium-search-container'
            )
            els.forEach((el) => {
              try {
                const he = el as HTMLElement
                he.style.display = 'none'
                he.style.visibility = 'hidden'
                he.style.pointerEvents = 'none'
              } catch (e) { /* ignore */ }
            })
          }
        } catch (e) {
          // ignore overall errors
        }
      }

      // hide immediately and also keep hiding after each render (some widgets re-add themselves)
      hideCesiumUI()
      if (viewer && viewer.scene && viewer.scene.postRender) {
        postRenderHideHandler = () => hideCesiumUI()
        viewer.scene.postRender.addEventListener(postRenderHideHandler)
      }

      ;(viewer as any).__hideCreditsPostRenderHandler = postRenderHideHandler
    } catch (e) { /* ignore */ }

    // --- GLB loader & helpers ---
    const addedModels: any[] = []
    const createdBlobUrls: string[] = []

    const loadGLB = async (fileOrUrl: File | string) => {
      try {
        const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl)
        const isBlob = typeof fileOrUrl !== 'string'
        if (isBlob) createdBlobUrls.push(url)

        // try to create Resource when available
        let resourceForModel: any = url
        try {
          if (typeof (Resource as any).fromUrl === 'function') {
            resourceForModel = (Resource as any).fromUrl(url)
          }
        } catch (e) { /* ignore */ }

        // try multiple Model creation shapes
        let model: any = null
        const attemptErrors: string[] = []
        const tryCreate = (fn: () => any, desc: string) => {
          try {
            const m = fn()
            if (m) return m
            return null
          } catch (err: any) {
            attemptErrors.push(`[${desc}] ${err && err.message ? err.message : String(err)}`)
            // eslint-disable-next-line no-console
            console.debug('Model creation attempt failed', desc, err)
            return null
          }
        }

        const attempts: Array<() => any> = []
        attempts.push(() => (typeof (Model as any).fromGltf === 'function') ? (Model as any).fromGltf({ url: resourceForModel }) : null)
        attempts.push(() => (typeof (Model as any).fromGltf === 'function') ? (Model as any).fromGltf({ url }) : null)
        attempts.push(() => new (Model as any)({ url: resourceForModel }))
        attempts.push(() => new (Model as any)({ url }))
        attempts.push(() => new (Model as any)({ uri: url }))

        for (let i = 0; i < attempts.length; i++) {
          model = tryCreate(attempts[i], `attempt_${i}`)
          if (model) break
        }

        if (!model) {
          const agg = attemptErrors.join(' | ')
          if (isBlob) {
            try { URL.revokeObjectURL(url) } catch (revErr) { /* ignore */ }
            const idx = createdBlobUrls.indexOf(url)
            if (idx >= 0) createdBlobUrls.splice(idx, 1)
          }
          const err = new Error('Failed to create Model. Details: ' + agg)
          // eslint-disable-next-line no-console
          console.error(err)
          throw err
        }

        viewer.scene.primitives.add(model)
        addedModels.push(model)

        try {
          await model.readyPromise
          try {
            const boundingSphere = (model as any).boundingSphere
            if (boundingSphere && viewer && viewer.camera && (viewer.camera as any).flyToBoundingSphere) {
              try { (viewer.camera as any).flyToBoundingSphere(boundingSphere, { duration: 1.0 }) } catch (err) { try { viewer.zoomTo(model) } catch (e) { /* ignore */ } }
            } else {
              try { viewer.zoomTo(model) } catch (e) { /* ignore */ }
            }
          } catch (e) { /* ignore camera errors */ }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('GLB model ready failed', e)
        }

        return model
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load GLB', e)
        throw e
      }
    }

    ;(window as any).loadGLB = loadGLB
    // expose a function to open the hidden file input from toolbar
    ;(window as any).openGLBFileDialog = () => {
      try { if (fileInputRef.current) fileInputRef.current.click() } catch (e) { /* ignore */ }
    }

    return () => {
      try {
        try { (window as any).loadGLB = undefined } catch (e) { /* ignore */ }
        try { (window as any).openGLBFileDialog = undefined } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }
      try { viewer.destroy() } catch (e) { /* ignore */ }
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 56px)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <input ref={fileInputRef} type="file" accept=".glb,.gltf,model/gltf-binary" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  )
}

