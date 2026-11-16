import { setUnit, useUnit } from '../hooks/useUnit'

export function UnitSwitch() {
  const unit = useUnit()
  const inches = unit === 'in'
  return (
    <div className="unit-toggle">
      <span className={inches ? '' : 'on'} aria-hidden="true">cm</span>
      <button
        type="button" role="switch" className="theme-switch" aria-checked={inches} aria-label="Show inches"
        title={inches ? 'Show centimeters' : 'Show inches'} onClick={() => setUnit(inches ? 'cm' : 'in')}
      >
        <span className="theme-switch-knob" aria-hidden="true" />
      </button>
      <span className={inches ? 'on' : ''} aria-hidden="true">in</span>
    </div>
  )
}
