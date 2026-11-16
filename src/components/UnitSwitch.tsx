import { setUnit, useUnit } from '../hooks/useUnit'

export function UnitSwitch() {
  const unit = useUnit()
  return (
    <div className="unit-switch" role="group" aria-label="Units">
      {(['cm', 'in'] as const).map(option => (
        <button key={option} type="button" aria-pressed={unit === option} title={option === 'cm' ? 'Show centimeters' : 'Show inches'} onClick={() => setUnit(option)}>{option}</button>
      ))}
    </div>
  )
}
