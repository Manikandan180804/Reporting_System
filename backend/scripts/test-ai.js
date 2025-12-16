/**
 * Test script to verify AI Service functionality
 * Run with: node scripts/test-ai.js
 */

require('dotenv').config();
const aiService = require('../services/aiService');

async function testAIService() {
    console.log('🧪 Testing AI Service with HuggingFace Integration\n');
    console.log('='.repeat(60));

    // Test incident data
    const testIncident = {
        title: 'Database server is down causing application outage',
        description: 'The production database server has crashed and users cannot access the application. Multiple error logs show connection timeout issues. This is affecting all customers and needs immediate attention.',
        category: 'database',
        severity: 'critical'
    };

    try {
        // 1. Test Triage Prediction
        console.log('\n📋 1. Testing AI Triage Prediction...');
        const triageResult = await aiService.predictTriage(testIncident);
        console.log('   Category:', triageResult.predictedCategory);
        console.log('   Severity:', triageResult.predictedSeverity);
        console.log('   Category Confidence:', Math.round((triageResult.categoryConfidence || 0) * 100) + '%');
        console.log('   Severity Confidence:', Math.round((triageResult.severityConfidence || 0) * 100) + '%');
        console.log('   Assigned Team:', triageResult.assignedTeam);
        console.log('   AI Powered:', triageResult.aiPowered ? '✅ Yes' : '❌ Fallback');

        // 2. Test Embedding Generation
        console.log('\n🔢 2. Testing Semantic Embedding Generation...');
        const embedding = await aiService.generateEmbedding(testIncident.title + '. ' + testIncident.description);
        console.log('   Embedding dimensions:', embedding.length);
        console.log('   First 5 values:', embedding.slice(0, 5).map(v => v.toFixed(4)).join(', '));

        // 3. Test Solution Generation
        console.log('\n💡 3. Testing AI Solution Generation...');
        const solutions = await aiService.generateSolutionSuggestions(testIncident);
        console.log('   Generated Solutions:');
        solutions.forEach((sol, i) => {
            console.log(`   ${i + 1}. ${sol.substring(0, 80)}...`);
        });

        // 4. Test Summarization
        console.log('\n📝 4. Testing AI Summarization...');
        const summary = await aiService.summarizeIncident(testIncident.description);
        console.log('   Summary:', summary.substring(0, 100));

        console.log('\n' + '='.repeat(60));
        console.log('✅ All AI Service tests completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
}

testAIService();
