const DynamicOptionComponent = ({ id, name, logo, isSelected, onSelectedChange, groupName = 'optionGroup' }) => {
    return (
        <label htmlFor={`${groupName}-${id}`} className="flex items-center cursor-pointer m-1 pr-2 rounded-lg text-gray-300 border border-neutral-500 bg-gradient-to-br from-neutral-600 to-neutral-900">
            <img src={logo} alt={name} className="w-7 h-7 mr-2 rounded-l-lg" />
            <span className="mr-2">{name}</span>
            <input
                type="radio"
                id={`${groupName}-${id}`}
                name={groupName}
                checked={isSelected}
                onChange={() => onSelectedChange(id)}
                className="form-radio"
            />
        </label>
    );
};

export default DynamicOptionComponent;
