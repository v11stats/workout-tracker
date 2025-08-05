import React, { useState, useEffect } from 'react';

const EditableSummaryField = ({ label, value: initialValue, onChange, type = 'text', unit = '', readOnly = false, style = {}, maxLength }) => {
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [isValidInput, setIsValidInput] = useState(true); // For visual feedback

  useEffect(() => {
    setCurrentValue(initialValue);
    setIsValidInput(true); // Reset validation status when initial value changes
  }, [initialValue]);

  const validateInput = (value) => {
    if (type === 'number') {
      return value === '' || !isNaN(Number(value));
    } else if (type === 'timeString') { // e.g., "Xm Ys" or "Xm" or "Ys" or just number (seconds)
      // Allows: "10m 30s", "5m", "45s", "120"
      // Does not strictly enforce "m" before "s" or single space, but checks characters.
      // More robust parsing/validation is in App.js
      return /^[0-9ms\s]*$/.test(value);
    } else if (type === 'totalTimeString') { // e.g., "H:MM" or "M"
      // Allows "1:30", "2:00", "90" (interpreted as minutes by parser)
      return /^[0-9:]*$/.test(value);
    }
    return true; // Default for 'text' or unknown types
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    const isCurrentlyValid = validateInput(newValue);

    setIsValidInput(isCurrentlyValid);
    setCurrentValue(newValue); // Update input field immediately for responsiveness

    if (isCurrentlyValid) {
      onChange(newValue); // Propagate valid or potentially valid change to parent for further processing
    }
    // If not isCurrentlyValid, App.js handlers should ideally not update the actual data state,
    // or should revert/clamp it. The visual cue here is immediate.
  };

  const getInputType = () => {
    // Using 'text' for number as well, because type="number" can be finicky with controlled components
    // and intermediate input states (like empty string, or trailing decimal point).
    // Validation will handle if it's a number.
    return 'text';
  };

  const inputStyle = {
    padding: '5px',
    border: `1px solid ${isValidInput ? '#ccc' : 'red'}`,
    borderRadius: '4px',
    backgroundColor: readOnly ? '#f0f0f0' : (isValidInput ? 'white' : '#fff0f0'),
    color: readOnly ? '#555' : 'black',
    ...style, // Merge custom styles
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      {label && <label style={{ marginRight: '5px', fontWeight: 'bold' }}>
        {label}:
      </label>}
      <input
        type={getInputType()}
        value={currentValue}
        onChange={handleChange}
        readOnly={readOnly}
        style={inputStyle}
        maxLength={maxLength}
      />
      {unit && <span style={{ marginLeft: '5px' }}>{unit}</span>}
    </div>
  );
};

export default EditableSummaryField;
