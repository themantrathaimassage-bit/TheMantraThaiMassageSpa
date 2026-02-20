import React, { useState } from 'react';
import styles from './ServiceCard.module.css';
import ServiceDescriptionModal from './ServiceDescriptionModal';

const ServiceCard = ({ service, onSelect, buttonText }) => {
    const variations = service?.variations || [];
    const [selectedVarId, setSelectedVarId] = useState(variations[0]?.id);
    const [showModal, setShowModal] = useState(false);

    const activeVar = variations.find(v => v.id === selectedVarId) || variations[0];

    const handleSelect = (e) => {
        if (e) e.stopPropagation();
        if (!activeVar) return;

        const selectedService = {
            ...activeVar,
            name: activeVar.fullName || service.name,
            description: service.description,
            isAddon: service.isAddon
        };
        onSelect(selectedService);
    };

    const isAddon = service.isAddon;

    if (!activeVar) return null; // Safety: don't render if variations are missing

    return (
        <>
            <div
                className={`${styles.card} ${isAddon ? styles.addonCard : ''}`}
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
                </div>

                <div className={styles.selectionArea}>
                    {variations.length > 1 && (
                        <div className={styles.durationSelector}>
                            <div className={styles.pillGrid}>
                                {variations.map((v) => (
                                    <button
                                        key={v.id}
                                        className={`${styles.durationPill} ${selectedVarId === v.id ? styles.pillActive : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedVarId(v.id);
                                        }}
                                    >
                                        {v.duration}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className={`${styles.addButton} ${isAddon ? styles.addonButton : ''}`}
                        onClick={handleSelect}
                    >
                        {buttonText || (isAddon ? 'Add' : 'Book')}
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
