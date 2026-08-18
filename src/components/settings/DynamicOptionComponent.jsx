const DynamicOptionComponent = ({ id, name, logo, isSelected, onSelectedChange, groupName = 'optionGroup' }) => {
    return (
        <label
            htmlFor={`${groupName}-${id}`}
            className={`flex items-center m-1 group ${
                isSelected ? 'card-option-selected' : 'card-option'
            }`}
        >
            <div className="relative">
                <img
                    src={logo}
                    alt={name}
                    className={`w-6 h-6 mr-3 rounded transition-all duration-200 ${
                        isSelected ? 'scale-110 shadow-sm' : 'group-hover:scale-110'
                    }`}
                />
            </div>
            <span className={`font-bold text-sm tracking-wide transition-colors ${isSelected ? 'text-accent-primary' : 'group-hover:text-text-primary'}`}>
                {name}
            </span>
            <input
                type="radio"
                id={`${groupName}-${id}`}
                name={groupName}
                checked={isSelected}
                onChange={() => onSelectedChange(id)}
                className="hidden"
            />
        </label>
    );
};

export default DynamicOptionComponent;
