import React from 'react';
import { FiCheck } from 'react-icons/fi';
import styles from './AddonCard.module.css';

// Simple emoji map for add-on names
const getIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('hot oil') && n.includes('hot stone')) return '🔥🪨';
    if (n.includes('hot oil')) return '🔥';
    if (n.includes('hot stone')) return '🪨';
    if (n.includes('coconut')) return '🥥';
    if (n.includes('deep')) return '💪';
    if (n.includes('aroma')) return '🌸';
    if (n.includes('scrub')) return '✨';
    return '⭐';
};

const AddonCard = ({ service, onSelect, selectedIds = [] }) => {
    const variations = service?.variations || [];
    const activeVar = variations[0];
    if (!activeVar) return null;

    const isSelected = selectedIds.includes(activeVar.id);

    const handleToggle = () => {
        const serviceObj = {
            ...activeVar,
            baseServiceName: service.name,
            name: activeVar.fullName || service.name,
            description: service.description,
            isAddon: true,
        };
        onSelect(serviceObj);
    };

    return (
        <button
            className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
            onClick={handleToggle}
        >
            {/* Icon bubble */}
            <span className={`${styles.icon} ${isSelected ? styles.iconSelected : ''}`}>
                {getIcon(service.name)}
            </span>

            {/* Name + price */}
            <div className={styles.info}>
                <span className={styles.name}>{service.name}</span>
                <span className={styles.price}>+${activeVar.price}</span>
            </div>

            {/* Toggle switch */}
            <div className={`${styles.toggle} ${isSelected ? styles.toggleOn : ''}`}>
                <div className={`${styles.knob} ${isSelected ? styles.knobOn : ''}`}>
                    {isSelected && <FiCheck size={9} strokeWidth={3} color="#111" />}
                </div>
            </div>
        </button>
    );
};

export default AddonCard;
