import React, { useState } from 'react';
import { FiX, FiAlertTriangle, FiCheckSquare, FiSquare } from 'react-icons/fi';
import styles from './CashOnlyModal.module.css';

const CashOnlyModal = ({ onConfirm, onCancel }) => {
    const [checked, setChecked] = useState(false);

    return (
        <div className={styles.backdrop} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.iconWrapper}>
                        <FiAlertTriangle size={24} />
                    </div>
                    <button className={styles.closeBtn} onClick={onCancel}>
                        <FiX size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.body}>
                    <h2 className={styles.title}>Cash Payment Required</h2>
                    <p className={styles.subtitle}>
                        You've selected a <strong>Cash Only</strong> promotion.
                        Cash payment is required at the store — card payments will not be accepted.
                    </p>

                    {/* Checkbox confirmation */}
                    <button
                        className={`${styles.checkRow} ${checked ? styles.checkRowChecked : ''}`}
                        onClick={() => setChecked(p => !p)}
                    >
                        <span className={styles.checkIcon}>
                            {checked
                                ? <FiCheckSquare size={20} />
                                : <FiSquare size={20} />}
                        </span>
                        <span className={styles.checkLabel}>
                            I understand — I will bring <strong>cash</strong> to pay at the store
                        </span>
                    </button>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onCancel}>
                        Go back
                    </button>
                    <button
                        className={`${styles.confirmBtn} ${!checked ? styles.confirmDisabled : ''}`}
                        onClick={() => checked && onConfirm()}
                        disabled={!checked}
                    >
                        Confirm &amp; Book
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashOnlyModal;
