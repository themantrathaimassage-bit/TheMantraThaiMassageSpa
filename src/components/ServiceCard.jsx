import React, { useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import styles from './ServiceCard.module.css';
import ServiceDescriptionModal from './ServiceDescriptionModal';

const ServiceCard = ({ service, onSelect, selectedIds = [], buttonText }) => {
    const variations = service?.variations || [];
    const [selectedVarId, setSelectedVarId] = useState(() => {
        const selectedForThisService = variations.find(v => selectedIds.includes(v.id));
        return selectedForThisService ? selectedForThisService.id : variations[0]?.id;
    });
    const [showModal, setShowModal] = useState(false);

    // Sync selectedVarId if selectedIds changes
    React.useEffect(() => {
        const selectedForThisService = variations.find(v => selectedIds.includes(v.id));
        if (selectedForThisService && selectedForThisService.id !== selectedVarId) {
            setSelectedVarId(selectedForThisService.id);
        }
    }, [selectedIds, variations]);

    const activeVar = variations.find(v => v.id === selectedVarId) || variations[0];
    const isSelected = selectedIds.includes(activeVar?.id);
    const isAddon = service.isAddon;

    const handleSelect = (e) => {
        if (e) e.stopPropagation();
        if (!activeVar) return;
        if (isSelected) return;

        const selectedService = {
            ...activeVar,
            baseServiceName: service.name,
            name: activeVar.fullName || service.name,
            description: service.description,
            isAddon: service.isAddon
        };
        onSelect(selectedService);
    };

    if (!activeVar) return null;

    return (
        <>
            <div
                className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                onClick={() => setShowModal(true)}
            >
                <div className={styles.mainInfo}>
                    <div className={styles.header}>
                        <h3 className={styles.serviceName}>{service.name}</h3>
                        <div className={styles.priceTag}>
                            {isAddon ? `+$${activeVar.price}` : `$${activeVar.price}`}
                        </div>
                    </div>

                    {service.description && (
                        <div className={styles.descriptionWrapper}>
                            <p className={styles.description}>
                                {service.description}
                            </p>
                            <span className={styles.moreLink}>read more</span>
                        </div>
                    )}

                    {/* Subtle add-on hint tag */}
                    {isAddon && (
                        <span className={styles.addonTag}>Add-on</span>
                    )}
                </div>

                <div className={styles.selectionArea}>
                    {variations.length > 1 && (
                        <div className={styles.durationSelector}>
                            <div className={styles.pillGrid}>
                                {variations.map((v) => (
                                    <button
                                        key={v.id}
                                        className={`${styles.durationPill} ${selectedVarId === v.id ? styles.pillActive : ''} ${selectedIds.includes(v.id) ? styles.pillSelected : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedVarId(v.id);
                                        }}
                                        disabled={isSelected && selectedVarId === v.id}
                                    >
                                        {v.duration}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className={`${styles.addButton} ${isSelected ? styles.selectedButton : ''}`}
                        onClick={handleSelect}
                    >
                        {isSelected ? (
                            <><FiCheck className={styles.checkIcon} /> Added</>
                        ) : (
                            buttonText || (isAddon ? 'Add' : 'Book')
                        )}
                    </button>
                </div>
            </div>

            {showModal && (
                <ServiceDescriptionModal
                    service={{
                        ...service,
                        price: activeVar.price,
                        duration: activeVar.duration
                    }}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default ServiceCard;
