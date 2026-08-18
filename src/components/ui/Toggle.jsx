import './Toggle.css';

/**
 * Toggle Switch — a themed iOS-style toggle replacing native checkboxes.
 *
 * Props:
 *   checked  — boolean, whether the toggle is on
 *   onChange — callback receiving the React change event (use e.target.checked)
 *   className — optional additional CSS classes
 *
 * Clicking the toggle stops event propagation so wrapping cards with onClick
 * handlers don't double-fire.
 */
const Toggle = ({ checked, onChange, className = '' }) => (
    <label
        className={`toggle ${className}`}
        onClick={(e) => e.stopPropagation()}
    >
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="toggle-thumb" />
    </label>
);

export default Toggle;
