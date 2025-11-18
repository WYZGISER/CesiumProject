import React from 'react'

export default function TopToolbar() {
  const onLoadData = () => {
    try {
      const fn = (window as any).openGLBFileDialog
      if (typeof fn === 'function') {
        fn()
      } else {
        // eslint-disable-next-line no-console
        console.warn('openGLBFileDialog not available')
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to call openGLBFileDialog', e)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 56,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      background: '#0b3d91',
      color: '#fff',
      zIndex: 2000,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>工具栏</div>
      <div style={{ marginLeft: 16 }}>
        <button onClick={onLoadData} style={{
          background: '#1454b3',
          color: '#fff',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 4,
          cursor: 'pointer'
        }}>加载数据</button>
      </div>
    </div>
  )
}
