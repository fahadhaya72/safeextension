// trusted-domains.js

/**
 * A comprehensive whitelist of trusted domains and verification functions.
 * This file provides functionality to check if a domain is trusted.
 */

// Define the whitelist of trusted domains
const trustedDomains = [
    'https://www.example1.com',
    'https://www.example2.com',
    'https://www.example3.com',
    // Add more domains as needed
];

/**
 * Checks if a given domain is trusted.
 * @param {string} domain - The domain to check.
 * @returns {boolean} - Returns true if the domain is trusted, false otherwise.
 */
function isDomainTrusted(domain) {
    return trustedDomains.includes(domain);
}

/**
 * Adds a new domain to the trusted list.
 * @param {string} domain - The domain to add.
 */
function addTrustedDomain(domain) {
    if (!trustedDomains.includes(domain)) {
        trustedDomains.push(domain);
        console.log(`Domain ${domain} added to trusted domains.`);
    } else {
        console.log(`Domain ${domain} is already in the trusted list.`);
    }
}

/**
 * Removes a domain from the trusted list.
 * @param {string} domain - The domain to remove.
 */
function removeTrustedDomain(domain) {
    const index = trustedDomains.indexOf(domain);
    if (index !== -1) {
        trustedDomains.splice(index, 1);
        console.log(`Domain ${domain} removed from trusted domains.`);
    } else {
        console.log(`Domain ${domain} is not in the trusted list.`);
    }
}

module.exports = {
    isDomainTrusted,
    addTrustedDomain,
    removeTrustedDomain
};