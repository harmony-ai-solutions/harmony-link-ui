import { useState } from 'react';

import DynamicOptionComponent from "./DynamicOptionComponent.jsx";

const DynamicOptionsGroup = ({ options, selectedOption, onSelectedChange, groupName = 'optionGroup' }) => {
    return (
        <div className="flex flex-wrap items-center w-full justify-center overflow-x-auto p-1">
            {options.map((option) => (
                <DynamicOptionComponent
                    key={option.id}
                    id={option.id}
                    name={option.name}
                    logo={option.logo}
                    isSelected={selectedOption === option.id}
                    onSelectedChange={onSelectedChange}
                    groupName={groupName}
                />
            ))}
        </div>
    );
};

export default DynamicOptionsGroup;
