import React, { useEffect, useRef } from 'react'
import { Viewer, Ion, UrlTemplateImageryProvider, Cartesian3, Color, JulianDate, SceneMode } from 'cesium'

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Cesium base URL and Ion token should already be set in main.tsx
    // Use OpenStreetMap as a default imagery provider so the globe is visible
    // even if no Cesium Ion token is provided.
    const viewer = new Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      // Force the viewer to run in 3D-only mode to ensure a 3D globe is shown
      scene3DOnly: true,
      // Hide the five top-right buttons (home, base layer, scene mode,
      // navigation help, fullscreen) while keeping other UI available
      baseLayerPicker: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      fullscreenButton: false,
      // keep other widgets default/available
      vrButton: true,
      geocoder: true,
      infoBox: true,
      selectionIndicator: true,
    })

    // Expose viewer on window for debugging only after the scene is ready.
    // Some environments may not have `viewer.scene` immediately available,
    // so wait for the first postRender event to attach the global.
    try {
      const attachGlobal = () => {
        try {
          ;(window as any).viewer = viewer
          ;(window as any).getSceneMode = () => (viewer && viewer.scene ? viewer.scene.mode : undefined)
        } catch (e) {
          // ignore
        }
      }

      if (viewer && viewer.scene && viewer.scene.postRender) {
        const handler = () => {
          attachGlobal()
          try {
            viewer.scene.postRender.removeEventListener(handler)
          } catch (e) {
            // ignore
          }
        }
        viewer.scene.postRender.addEventListener(handler)
      } else {
        // fallback: attach after a short delay
        setTimeout(attachGlobal, 200)
      }
    } catch (e) {
      // ignore
    }

    // Ensure the scene actually becomes 3D: try morphing a few times if necessary.
    // Some environments may delay availability; retry for up to ~2 seconds.
    try {
      const maxAttempts = 20
      let attempts = 0
      const ensure3D = () => {
        attempts++
        try {
          if (viewer && viewer.scene && viewer.scene.mode !== SceneMode.SCENE3D) {
            // attempt to morph to 3D instantly
            if (viewer.scene.morphTo3D) viewer.scene.morphTo3D(0)
          }
        } catch (e) {
          // ignore
        }
        // stop retrying if in 3D or exceeded attempts
        if (viewer && viewer.scene && viewer.scene.mode === SceneMode.SCENE3D) {
          // eslint-disable-next-line no-console
          console.log('CesiumViewer: scene is 3D')
          return
        }
        if (attempts < maxAttempts) {
          setTimeout(ensure3D, 100)
        } else {
          // eslint-disable-next-line no-console
          console.warn('CesiumViewer: failed to switch to 3D after retries, current mode =', viewer && viewer.scene ? viewer.scene.mode : undefined)
        }
      }
      ensure3D()

      // expose helper to force 3D from console
      ;(window as any).force3D = () => {
        try {
          if (viewer && viewer.scene && viewer.scene.morphTo3D) viewer.scene.morphTo3D(0)
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // Set an initial camera view so we start looking at the globe.
    // Default view: Hengqin Island, Zhuhai (横琴岛)
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(113.5535, 22.1216, 5000), // lon, lat, height (meters)
      orientation: {
        heading: 0.0,
        pitch: -Math.PI / 6, // look down ~30 degrees
        roll: 0.0
      }
    })

    // Set scene time to a fixed UTC noon so the sun lights a predictable side of the globe
    try {
      viewer.clock.currentTime = JulianDate.fromDate(new Date(Date.UTC(2025, 10, 17, 12, 0, 0)))
      viewer.clock.shouldAnimate = false
    } catch (e) {
      // ignore if clock not available
    }

    // Ensure globe is visible and show atmosphere, hide the starry skybox so
    // the view feels like looking at the Earth rather than deep space.
    try {
      viewer.scene.globe.show = true
      viewer.scene.globe.enableLighting = true
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = false
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true
      // make background slightly bluish near horizon if desired
      viewer.scene.backgroundColor = Color.BLACK
    } catch (e) {
      // ignore if some properties are not available
    }

    // Ensure the scene is in 3D mode. For some environments morphTo3D
    // must be called after the first render, so schedule it on next tick.
    try {
      setTimeout(() => {
        try {
          if (viewer.scene.mode !== SceneMode.SCENE3D) {
            viewer.scene.morphTo3D(0)
          }
        } catch (err) {
          // ignore
        }
      }, 0)
    } catch (e) {
      // ignore if morphing not supported
    }

    // Replace base imagery with a satellite (remote sensing) imagery layer.
    // This example uses Esri World Imagery tiles (public endpoint).
    // Alternatives: Bing Aerial (requires API key), Mapbox Satellite (requires token), or Cesium Ion imagery (requires token).
    try {
      const esriUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      const satProvider = new UrlTemplateImageryProvider({ url: esriUrl, credit: 'Esri World Imagery' })

      // remove existing layers and add satellite imagery explicitly
      viewer.imageryLayers.removeAll()
      viewer.imageryLayers.addImageryProvider(satProvider)
      // log imagery layer count
      // eslint-disable-next-line no-console
      console.log('CesiumViewer: imageryLayers count =', viewer.imageryLayers.length)

      // quick tile fetch test (log result) to help diagnose network/CORS
      const sampleTile = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/0/0'
      fetch(sampleTile).then((r) => {
        // eslint-disable-next-line no-console
        console.log('Sample satellite tile fetch', sampleTile, 'status', r.status)
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Sample satellite tile fetch error', err)
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to add satellite imagery provider', e)
    }

    // --- 新增：隐藏 Cesium 底部 logo / 说明（credits）并隐藏右上角搜索框（geocoder），保持隐藏 ---
    try {
      // 持有引用以便 cleanup 时移除
      let postRenderHandler: any = undefined

      const hideCesiumUI = () => {
        try {
          // 优先通过私有 api 隐藏 credit container（兼容常见 Cesium 版本）
          const cw = (viewer as any)?._cesiumWidget
          const creditContainers = [
            cw && cw._creditContainer,
            cw && cw._creditContainerElement,
            cw && cw._creditsContainer
          ].filter(Boolean)

          creditContainers.forEach((c: any) => {
            try {
              if (c && c.style) {
                c.style.display = 'none'
                c.style.visibility = 'hidden'
                c.style.pointerEvents = 'none'
              }
            } catch (e) {
              // ignore
            }
          })

          // 如果 viewer 提供 geocoder 对象，优先隐藏其容器（更安全）
          try {
            const geocoder = (viewer as any).geocoder
            if (geocoder && geocoder.container && geocoder.container.style) {
              geocoder.container.style.display = 'none'
              geocoder.container.style.visibility = 'hidden'
              geocoder.container.style.pointerEvents = 'none'
            }
          } catch (e) {
            // ignore
          }

          // 使用明确的 class 选择器隐藏可能的 DOM 节点（仅限 credit 和 geocoder 相关类）
          if (containerRef.current) {
            const uiEls = containerRef.current.querySelectorAll(
              '.cesium-credit, .cesium-credit-container, .cesium-creditContainer, .cesium-credit-logo, .cesium-credit-image, .cesium-credit-text, .cesium-credits, .cesium-geocoder, .cesium-geocoder-container, .cesium-search, .cesium-search-container'
            )
            uiEls.forEach(el => {
              try {
                const he = el as HTMLElement
                he.style.display = 'none'
                he.style.visibility = 'hidden'
                he.style.pointerEvents = 'none'
              } catch (e) {
                // ignore
              }
            })
          }
        } catch (e) {
          // ignore
        }
      }

      // 立即隐藏一次
      hideCesiumUI()

      // 注册到 postRender，确保渲染更新后仍然被隐藏
      if (viewer && viewer.scene && viewer.scene.postRender) {
        postRenderHandler = () => {
          hideCesiumUI()
        }
        viewer.scene.postRender.addEventListener(postRenderHandler)
      } else {
        // 兜底定时再次隐藏
        setTimeout(hideCesiumUI, 200)
      }

      // 在 cleanup 中我们需要移除此处理器；把 postRenderHandler 挂到 viewer 对象上以便访问
      ;(viewer as any).__hideCreditsPostRenderHandler = postRenderHandler
    } catch (e) {
      // ignore
    }
    // --- 新增结束 ---

    // No diagnostics UI: keep viewer clean (all UI widgets off by default below)

    // Example: if you have a local 3D Tiles tileset, add it like this:
    // viewer.scene.primitives.add(new Cesium.Cesium3DTileset({ url: '/tiles/tileset.json' }))

    return () => {
      try {
        // 移除我们注册的 postRender handler（如果存在），避免内存泄漏
        try {
          const handler = (viewer as any).__hideCreditsPostRenderHandler
          if (handler && viewer && viewer.scene && viewer.scene.postRender && viewer.scene.postRender.removeEventListener) {
            viewer.scene.postRender.removeEventListener(handler)
          }
        } catch (e) {
          // ignore
        }

        viewer.destroy()
        try {
          ;(window as any).viewer = undefined
          ;(window as any).getSceneMode = undefined
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

    return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
}

