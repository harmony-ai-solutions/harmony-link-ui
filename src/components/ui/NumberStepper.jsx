import { useRef, useCallback } from 'react';
import './NumberStepper.css';

/**
 * NumberStepper — Custom +/- stepper replacing native <input type="number">.
 *
 * Glassmorphism design matching the Toggle & input-field aesthetics.
 * Fires onChange / onBlur with a synthetic event:
 *   { target: { value: String(newValue), name, type: 'number' } }
 * so existing handlers expecting e.target.value continue to work unchanged.
 *
 * Props:
 *   value       — current numeric value
 *   onChange    — callback( syntheticEvent )
 *   onBlur      — optional callback( syntheticEvent ) forwarded after internal clamp
 *   min         — optional minimum
 *   max         — optional maximum
 *   step        — increment/decrement step (default 1)
 *   disabled    — whether the entire stepper is disabled
 *   className   — additional CSS classes on the wrapper
 *   placeholder — placeholder text for the input
 *   name        — form field name passed through the synthetic event
 */
const NumberStepper = ({
    value,
    onChange,
    onBlur,
    min,
    max,
    step = 1,
    disabled = false,
    className = '',
    placeholder = '',
    name = '',
}) => {
    const inputRef = useRef(null);

    const clamp = useCallback((val) => {
        let num = Number(val);
        if (isNaN(num)) num = 0;
        if (min !== undefined && num < min) num = min;
        if (max !== undefined && num > max) num = max;
        return num;
    }, [min, max]);

    const fireChange = useCallback((newValue) => {
        if (onChange) {
            onChange({ target: { value: String(newValue), name, type: 'number' } });
        }
    }, [onChange, name]);

    const fireBlur = useCallback((newValue) => {
        if (onBlur) {
            onBlur({ target: { value: String(newValue), name, type: 'number' } });
        }
    }, [onBlur, name]);

    const increment = useCallback(() => {
        if (disabled) return;
        const current = Number(value) || 0;
        const newVal = clamp(current + step);
        fireChange(newVal);
    }, [disabled, value, step, clamp, fireChange]);

    const decrement = useCallback(() => {
        if (disabled) return;
        const current = Number(value) || 0;
        const newVal = clamp(current - step);
        fireChange(newVal);
    }, [disabled, value, step, clamp, fireChange]);

    const handleInputChange = useCallback((e) => {
        fireChange(e.target.value);
    }, [fireChange]);

    const handleBlur = useCallback(() => {
        const current = Number(value);
        if (!isNaN(current)) {
            const clamped = clamp(current);
            if (clamped !== current) {
                fireChange(clamped);
            }
        }
        // Forward blur with the (possibly clamped) value
        fireBlur(clamp(current));
    }, [value, clamp, fireChange, fireBlur]);

    /* ── Button-disabled logic ────────────────────────────────── */
    const minusDisabled = disabled || (min !== undefined && Number(value) <= min);
    const plusDisabled  = disabled || (max !== undefined && Number(value) >= max);

    return (
        <div className={`number-stepper ${className} ${disabled ? 'number-stepper--disabled' : ''}`}>
            <button
                type="button"
                className="number-stepper__btn number-stepper__btn--minus"
                onClick={decrement}
                disabled={minusDisabled}
                aria-label="Decrease value"
                tabIndex={-1}
            >
                <svg width="12" height="2" viewBox="0 0 12 2" fill="none" aria-hidden="true">
                    <path d="M0 1h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                className="number-stepper__input"
                value={value ?? ''}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                name={name}
            />
            <button
                type="button"
                className="number-stepper__btn number-stepper__btn--plus"
                onClick={increment}
                disabled={plusDisabled}
                aria-label="Increase value"
                tabIndex={-1}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
};

export default NumberStepper;
