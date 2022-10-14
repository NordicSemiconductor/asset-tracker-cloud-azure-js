import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { v4 } from 'uuid'

/**
 * OpenSSL CA configuration
 *
 * The two configuration files listed on the page are identical except for the file locations.
 *
 * Unused settings have been commented out.
 *
 * @see https://learn.microsoft.com/en-us/azure/iot-dps/tutorial-custom-hsm-enrollment-group-x509?tabs=linux#set-up-the-x509-openssl-environment
 *
 * @return The path to the temporary file with the configuration
 */
export const opensslConfig = ({
	dir,
	privateKeyFile,
	certificateFile,
	validDays,
}: {
	/**
	 * Directory for certificate files
	 */
	dir: string
	/**
	 * Private key location
	 */
	privateKeyFile: string
	/**
	 * Certificate location
	 */
	certificateFile: string
	/**
	 * default: 375
	 */
	validDays?: number
}): string => {
	const config = [
		`[ ca ]`,
		`default_ca = CA_default`,
		`[ CA_default ]`,
		`dir               = ${dir}`,
		//`certs             = $dir/certs`,
		//`crl_dir           = $dir/crl`,
		`new_certs_dir     = $dir`,
		`database          = $dir/index.txt`,
		`serial            = $dir/serial`,
		//`RANDFILE          = $dir/private/.rand`,
		// The root key and root certificate.
		`private_key       = ${privateKeyFile}`,
		`certificate       = ${certificateFile}`,
		// ``,
		// // For certificate revocation lists.`,
		// `crlnumber         = $dir/crlnumber`,
		// `crl               = $dir/crl/azure-iot-test-only.intermediate.crl.pem`,
		// `crl_extensions    = crl_ext`,
		// `default_crl_days  = 30`,
		// ``,
		// // SHA-1 is deprecated, so use SHA-2 instead.`,
		`default_md        = sha256`,
		`name_opt          = ca_default`,
		`cert_opt          = ca_default`,
		`default_days      = ${validDays ?? 375}`,
		`preserve          = no`,
		`policy            = policy_loose`,
		// `[ policy_strict ]`,
		// // The root CA should only sign intermediate certificates that match.`,
		// `countryName             = optional`,
		// `stateOrProvinceName     = optional`,
		// `organizationName        = optional`,
		// `organizationalUnitName  = optional`,
		// `commonName              = supplied`,
		// `emailAddress            = optional`,
		// Allow the intermediate CA to sign a more diverse range of certificates.
		`[ policy_loose ]`,
		`countryName             = optional`,
		`stateOrProvinceName     = optional`,
		`localityName            = optional`,
		`organizationName        = optional`,
		`organizationalUnitName  = optional`,
		`commonName              = supplied`,
		`emailAddress            = optional`,
		`[ req ]`,
		`default_bits        = 2048`,
		`distinguished_name  = req_distinguished_name`,
		`string_mask         = utf8only`,
		// SHA-1 is deprecated, so use SHA-2 instead.
		`default_md          = sha256`,
		// Extension to add when the -x509 option is used.
		`x509_extensions     = v3_ca`,
		// See <https://en.wikipedia.org/wiki/Certificate_signing_request>.
		`[ req_distinguished_name ]`,
		// `countryName                     = Country Name (2 letter code)`,
		// `stateOrProvinceName             = State or Province Name`,
		// `localityName                    = Locality Name`,
		// `0.organizationName              = Organization Name`,
		// `organizationalUnitName          = Organizational Unit Name`,
		`commonName                      = Common Name`,
		// `emailAddress                    = Email Address`,
		// Optionally, specify some defaults.
		// `countryName_default             = US`,
		// `stateOrProvinceName_default     = WA`,
		// `localityName_default            =`,
		// `0.organizationName_default      = My Organization`,
		// `organizationalUnitName_default  =`,
		// `emailAddress_default            =`,
		// Extensions for a typical CA.
		`[ v3_ca ]`,
		`subjectKeyIdentifier = hash`,
		`authorityKeyIdentifier = keyid:always,issuer`,
		`basicConstraints = critical, CA:true`,
		`keyUsage = critical, digitalSignature, cRLSign, keyCertSign`,
		// Extensions for a typical intermediate CA. (same as v3_ca)
		`[ v3_intermediate_ca ]`,
		`subjectKeyIdentifier = hash`,
		`authorityKeyIdentifier = keyid:always,issuer`,
		`basicConstraints = critical, CA:true`,
		`keyUsage = critical, digitalSignature, cRLSign, keyCertSign`,
		// Extensions for client certificates.
		`[ usr_cert ]`,
		`basicConstraints = CA:FALSE`,
		`nsComment = "OpenSSL Generated Client Certificate"`,
		`subjectKeyIdentifier = hash`,
		`authorityKeyIdentifier = keyid,issuer`,
		`keyUsage = critical, nonRepudiation, digitalSignature, keyEncipherment`,
		`extendedKeyUsage = clientAuth`,
		// Extensions for server certificates.
		// `[ server_cert ]`,
		// `basicConstraints = CA:FALSE`,
		// `nsComment = "OpenSSL Generated Server Certificate"`,
		// `subjectKeyIdentifier = hash`,
		// `authorityKeyIdentifier = keyid,issuer:always`,
		// `keyUsage = critical, digitalSignature, keyEncipherment`,
		// `extendedKeyUsage = serverAuth`,
		// Extension for CRLs.
		// `[ crl_ext ]`,
		// `authorityKeyIdentifier=keyid:always`,
		// Extension for OCSP signing certificates.
		// `[ ocsp ]`,
		// `basicConstraints = CA:FALSE`,
		// `subjectKeyIdentifier = hash`,
		// `authorityKeyIdentifier = keyid,issuer`,
		// `keyUsage = critical, digitalSignature`,
		// `extendedKeyUsage = critical, OCSPSigning`,
	].join(os.EOL)

	const tempDir = mkdtempSync(
		path.join(os.tmpdir(), 'nrf-asset-tracker-azure-certs-'),
	)
	const configFile = path.join(tempDir, `openssl-${v4()}.conf`)
	writeFileSync(configFile, config, 'utf-8')
	return configFile
}
