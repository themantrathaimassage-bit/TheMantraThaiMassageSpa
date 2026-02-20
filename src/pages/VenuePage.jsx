import React, { useState } from 'react';
import HeroSection from '../components/HeroSection';
import { venueData } from '../data/venueData';
import ServiceList from '../components/ServiceList';
import { servicesData } from '../data/servicesData';
import { fetchSquareServices } from '../data/squareCatalog';
import AboutSection from '../components/AboutSection';
import ReviewsSection from '../components/ReviewsSection';
import { reviewsData } from '../data/reviewsData';
import StickyBookingCard from '../components/StickyBookingCard';
import styles from './VenuePage.module.css';

import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useCart } from '../context/CartContext';

const VenuePage = () => {
    const [venue, setVenue] = useState(venueData);
    const [services, setServices] = useState(servicesData);
    const [servicesLoading, setServicesLoading] = useState(true);
    const { searchQuery } = useSearch();
    const { addService } = useCart();
    const navigate = useNavigate();

    // Fetch live catalog from Square on mount
    React.useEffect(() => {
        setServicesLoading(true);
        fetchSquareServices().then(live => {
            if (live && live.length > 0) setServices(live);
            setServicesLoading(false);
        }).catch(() => {
            setServicesLoading(false);
        });
    }, []);

    const handleServiceSelect = (service) => {
        addService(service);
        navigate('/booking');
    };

    // Filter services based on search query
    const filteredServices = React.useMemo(() => {
        if (!searchQuery) return services;
        const lowerQuery = searchQuery.toLowerCase();
        return services.map(category => ({
            ...category,
            items: category.items.filter(item =>
                item.name.toLowerCase().includes(lowerQuery) ||
                (item.description && item.description.toLowerCase().includes(lowerQuery))
            )
        })).filter(category => category.items.length > 0);
    }, [searchQuery, services]);

    // Auto-scroll to section based on search query
    React.useEffect(() => {
        if (!searchQuery) return;
        const lowerQuery = searchQuery.toLowerCase();

        // Check for specific section keywords first
        if (lowerQuery.includes('opening') || lowerQuery.includes('hour') || lowerQuery.includes('time') || lowerQuery.includes('close')) {
            const element = document.getElementById('opening-hours');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        if (lowerQuery.includes('location') || lowerQuery.includes('map') || lowerQuery.includes('address') || lowerQuery.includes('where')) {
            const element = document.getElementById('location');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        if (lowerQuery.includes('review')) {
            const element = document.getElementById('reviews');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        // If searching for services (default), scroll to services list
        if (filteredServices.length > 0) {
            const element = document.getElementById('services');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [searchQuery, filteredServices]);

    return (
        <div className={styles.pageContainer}>
            <HeroSection venue={venue} />

            <div className={styles.contentGrid}>
                <div className={styles.mainContent}>
                    <div id="services" style={{ scrollMarginTop: '140px' }}>
                        <ServiceList
                            services={filteredServices}
                            onServiceSelect={handleServiceSelect}
                            isSearching={!!searchQuery}
                            isLoading={servicesLoading}
                            buttonText="Book"
                        />
                    </div>

                    <div id="location" style={{ scrollMarginTop: '140px' }}>
                        <AboutSection venue={venue} />
                    </div>

                    <div id="reviews" style={{ scrollMarginTop: '140px' }}>
                        <ReviewsSection
                            reviews={reviewsData}
                            rating={venue.rating}
                            reviewCount={venue.reviewCount}
                        />
                    </div>
                </div>

                <aside className={styles.sidebar}>
                    <StickyBookingCard venue={venue} />
                </aside>
            </div>
        </div>
    );
};

export default VenuePage;
