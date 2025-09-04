#!/usr/bin/env node

/**
 * Logging Configuration Manager
 * Easily enable/disable different aspects of request/response logging
 */

const fs = require('fs');
const path = require('path');

class LoggingConfig {
    constructor() {
        this.envPath = path.join(__dirname, '.env');
        this.configs = {
            'request': 'ENABLE_REQUEST_LOGGING',
            'response': 'ENABLE_RESPONSE_LOGGING',
            'payload': 'ENABLE_PAYLOAD_LOGGING',
            'req-headers': 'LOG_REQUEST_HEADERS',
            'res-headers': 'LOG_RESPONSE_HEADERS',
            'sensitive': 'LOG_SENSITIVE_DATA'
        };
    }

    /**
     * Read current .env file
     */
    readEnvFile() {
        try {
            return fs.readFileSync(this.envPath, 'utf8');
        } catch (error) {
            console.error('❌ Error reading .env file:', error.message);
            process.exit(1);
        }
    }

    /**
     * Write to .env file
     */
    writeEnvFile(content) {
        try {
            fs.writeFileSync(this.envPath, content);
            console.log('✅ .env file updated successfully');
        } catch (error) {
            console.error('❌ Error writing .env file:', error.message);
            process.exit(1);
        }
    }

    /**
     * Update a specific environment variable
     */
    updateEnvVar(varName, value) {
        let envContent = this.readEnvFile();
        const regex = new RegExp(`^${varName}=.*$`, 'm');
        
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${varName}=${value}`);
        } else {
            envContent += `\n${varName}=${value}`;
        }
        
        this.writeEnvFile(envContent);
    }

    /**
     * Get current value of environment variable
     */
    getCurrentValue(varName) {
        const envContent = this.readEnvFile();
        const regex = new RegExp(`^${varName}=(.*)$`, 'm');
        const match = envContent.match(regex);
        return match ? match[1] : 'undefined';
    }

    /**
     * Display current configuration
     */
    showConfig() {
        console.log('\n🔧 Current Logging Configuration:');
        console.log('==================================');
        
        Object.entries(this.configs).forEach(([key, envVar]) => {
            const value = this.getCurrentValue(envVar);
            const status = value === 'true' ? '✅ ENABLED' : '❌ DISABLED';
            console.log(`${key.padEnd(15)} | ${envVar.padEnd(25)} | ${status}`);
        });
        
        console.log('\nOther Settings:');
        console.log('==============');
        console.log(`MAX_LOG_SIZE: ${this.getCurrentValue('MAX_LOG_SIZE')}`);
        console.log(`EXCLUDE_ROUTES: ${this.getCurrentValue('EXCLUDE_ROUTES')}`);
        console.log('==================================\n');
    }

    /**
     * Enable all logging
     */
    enableAll() {
        console.log('🚀 Enabling all request/response logging...');
        Object.values(this.configs).forEach(envVar => {
            this.updateEnvVar(envVar, 'true');
        });
        console.log('✅ All logging features enabled');
    }

    /**
     * Disable all logging
     */
    disableAll() {
        console.log('🛑 Disabling all request/response logging...');
        Object.values(this.configs).forEach(envVar => {
            this.updateEnvVar(envVar, 'false');
        });
        console.log('✅ All logging features disabled');
    }

    /**
     * Set development mode (recommended settings for development)
     */
    setDevMode() {
        console.log('🔧 Setting development logging mode...');
        this.updateEnvVar('ENABLE_REQUEST_LOGGING', 'true');
        this.updateEnvVar('ENABLE_RESPONSE_LOGGING', 'true');
        this.updateEnvVar('ENABLE_PAYLOAD_LOGGING', 'true');
        this.updateEnvVar('LOG_REQUEST_HEADERS', 'false');
        this.updateEnvVar('LOG_RESPONSE_HEADERS', 'false');
        this.updateEnvVar('LOG_SENSITIVE_DATA', 'false');
        console.log('✅ Development mode configured');
    }

    /**
     * Set production mode (minimal logging for production)
     */
    setProdMode() {
        console.log('🔧 Setting production logging mode...');
        this.updateEnvVar('ENABLE_REQUEST_LOGGING', 'false');
        this.updateEnvVar('ENABLE_RESPONSE_LOGGING', 'false');
        this.updateEnvVar('ENABLE_PAYLOAD_LOGGING', 'false');
        this.updateEnvVar('LOG_REQUEST_HEADERS', 'false');
        this.updateEnvVar('LOG_RESPONSE_HEADERS', 'false');
        this.updateEnvVar('LOG_SENSITIVE_DATA', 'false');
        console.log('✅ Production mode configured (logging disabled)');
    }

    /**
     * Toggle a specific setting
     */
    toggle(configKey) {
        const envVar = this.configs[configKey];
        if (!envVar) {
            console.error(`❌ Unknown config key: ${configKey}`);
            console.log('Available keys:', Object.keys(this.configs).join(', '));
            return;
        }

        const currentValue = this.getCurrentValue(envVar);
        const newValue = currentValue === 'true' ? 'false' : 'true';
        this.updateEnvVar(envVar, newValue);
        
        const status = newValue === 'true' ? 'ENABLED' : 'DISABLED';
        console.log(`✅ ${configKey} (${envVar}) is now ${status}`);
    }

    /**
     * Show help
     */
    showHelp() {
        console.log('\n📖 Logging Configuration Manager');
        console.log('================================');
        console.log('Usage: node config-logging.js [command] [options]');
        console.log('\nCommands:');
        console.log('  show                    Show current configuration');
        console.log('  enable-all             Enable all logging features');
        console.log('  disable-all            Disable all logging features');
        console.log('  dev-mode               Set recommended development settings');
        console.log('  prod-mode              Set production settings (minimal logging)');
        console.log('  toggle <key>           Toggle a specific setting');
        console.log('\nToggle Keys:');
        Object.entries(this.configs).forEach(([key, envVar]) => {
            console.log(`  ${key.padEnd(15)} - ${envVar}`);
        });
        console.log('\nExamples:');
        console.log('  node config-logging.js show');
        console.log('  node config-logging.js enable-all');
        console.log('  node config-logging.js toggle payload');
        console.log('  node config-logging.js dev-mode');
        console.log('================================\n');
    }
}

// CLI interface
function main() {
    const config = new LoggingConfig();
    const args = process.argv.slice(2);

    if (args.length === 0) {
        config.showConfig();
        return;
    }

    const command = args[0];

    switch (command) {
        case 'show':
        case 'status':
            config.showConfig();
            break;
        
        case 'enable-all':
        case 'enable':
            config.enableAll();
            config.showConfig();
            break;
        
        case 'disable-all':
        case 'disable':
            config.disableAll();
            config.showConfig();
            break;
        
        case 'dev-mode':
        case 'development':
            config.setDevMode();
            config.showConfig();
            break;
        
        case 'prod-mode':
        case 'production':
            config.setProdMode();
            config.showConfig();
            break;
        
        case 'toggle':
            if (args[1]) {
                config.toggle(args[1]);
                config.showConfig();
            } else {
                console.error('❌ Please specify a config key to toggle');
                config.showHelp();
            }
            break;
        
        case 'help':
        case '--help':
        case '-h':
            config.showHelp();
            break;
        
        default:
            console.error(`❌ Unknown command: ${command}`);
            config.showHelp();
            break;
    }
}

if (require.main === module) {
    main();
}

module.exports = LoggingConfig;
