// Application Data
const sampleData = {
    customers: [
        {id: 1, name: "Alice Johnson", city: "London", age: 28, email: "alice@example.com"},
        {id: 2, name: "Bob Smith", city: "Paris", age: 34, email: "bob@example.com"},
        {id: 3, name: "Charlie Brown", city: "London", age: 45, email: "charlie@example.com"},
        {id: 4, name: "Diana Wilson", city: "Berlin", age: 29, email: "diana@example.com"},
        {id: 5, name: "Edward Davis", city: "Paris", age: 52, email: "edward@example.com"}
    ],
    orders: [
        {id: 1, customer_id: 1, product: "Laptop", amount: 1200.50, date: "2024-01-15"},
        {id: 2, customer_id: 2, product: "Phone", amount: 699.99, date: "2024-01-18"},
        {id: 3, customer_id: 1, product: "Headphones", amount: 149.99, date: "2024-02-01"},
        {id: 4, customer_id: 3, product: "Tablet", amount: 399.99, date: "2024-02-05"},
        {id: 5, customer_id: 2, product: "Watch", amount: 249.99, date: "2024-02-10"},
        {id: 6, customer_id: 4, product: "Camera", amount: 899.99, date: "2024-02-15"},
        {id: 7, customer_id: 5, product: "Keyboard", amount: 79.99, date: "2024-03-01"}
    ]
};

const sampleQueries = [
    {
        natural_language: "Show all customers from London",
        sql: "SELECT * FROM customers WHERE city = 'London';",
        description: "Retrieves all customer information for customers located in London"
    },
    {
        natural_language: "List orders with amount greater than 500",
        sql: "SELECT * FROM orders WHERE amount > 500;",
        description: "Shows all orders where the order amount exceeds $500"
    },
    {
        natural_language: "Find customers older than 30",
        sql: "SELECT * FROM customers WHERE age > 30;",
        description: "Retrieves customers whose age is greater than 30 years"
    },
    {
        natural_language: "Show total orders by customer",
        sql: "SELECT c.name, COUNT(o.id) as total_orders FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name;",
        description: "Displays each customer's name along with their total number of orders"
    },
    {
        natural_language: "Get average order amount",
        sql: "SELECT AVG(amount) as average_order_amount FROM orders;",
        description: "Calculates the average amount across all orders"
    }
];

// Query History
let queryHistory = [];

// NL to SQL Conversion Patterns - Fixed order and patterns
const conversionPatterns = [
    // City-based queries (more specific patterns first)
    {
        pattern: /(?:show|list|get|find) (?:all )?customers? (?:from|in|living in) (\w+)/i,
        template: (match) => `SELECT * FROM customers WHERE city = '${match[1]}';`
    },
    {
        pattern: /customers? (?:from|in|living in) (\w+)/i,
        template: (match) => `SELECT * FROM customers WHERE city = '${match[1]}';`
    },
    
    // Age-based queries
    {
        pattern: /(?:show|list|get|find) (?:all )?customers? (?:older than|above|greater than|over) (\d+)/i,
        template: (match) => `SELECT * FROM customers WHERE age > ${match[1]};`
    },
    {
        pattern: /(?:show|list|get|find) (?:all )?customers? (?:younger than|below|less than|under) (\d+)/i,
        template: (match) => `SELECT * FROM customers WHERE age < ${match[1]};`
    },
    {
        pattern: /customers? (?:older than|above|greater than|over) (\d+)/i,
        template: (match) => `SELECT * FROM customers WHERE age > ${match[1]};`
    },
    {
        pattern: /customers? (?:younger than|below|less than|under) (\d+)/i,
        template: (match) => `SELECT * FROM customers WHERE age < ${match[1]};`
    },
    
    // Amount-based queries
    {
        pattern: /(?:show|list|get|find) (?:all )?orders? (?:with amount |worth )?(?:greater than|above|over) (\d+)/i,
        template: (match) => `SELECT * FROM orders WHERE amount > ${match[1]};`
    },
    {
        pattern: /(?:show|list|get|find) (?:all )?orders? (?:with amount |worth )?(?:less than|below|under) (\d+)/i,
        template: (match) => `SELECT * FROM orders WHERE amount < ${match[1]};`
    },
    {
        pattern: /orders? (?:with amount |worth )?(?:greater than|above|over) (\d+)/i,
        template: (match) => `SELECT * FROM orders WHERE amount > ${match[1]};`
    },
    {
        pattern: /orders? (?:with amount |worth )?(?:less than|below|under) (\d+)/i,
        template: (match) => `SELECT * FROM orders WHERE amount < ${match[1]};`
    },
    
    // Aggregate functions
    {
        pattern: /(?:get |calculate |find |show )?(?:the )?average (?:order )?amount/i,
        template: () => `SELECT AVG(amount) as average_order_amount FROM orders;`
    },
    {
        pattern: /(?:get |calculate |find |show )?(?:the )?total (?:order )?amount/i,
        template: () => `SELECT SUM(amount) as total_order_amount FROM orders;`
    },
    {
        pattern: /(?:count |number of |how many )orders/i,
        template: () => `SELECT COUNT(*) as total_orders FROM orders;`
    },
    {
        pattern: /(?:count |number of |how many )customers/i,
        template: () => `SELECT COUNT(*) as total_customers FROM customers;`
    },
    
    // JOIN patterns
    {
        pattern: /(?:show |get |list )?(?:total )?orders? (?:by|per|for each) customer/i,
        template: () => `SELECT c.name, COUNT(o.id) as total_orders FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name;`
    },
    {
        pattern: /customer(?:s)? (?:with|and) (?:their )?orders/i,
        template: () => `SELECT c.name, c.city, o.product, o.amount, o.date FROM customers c LEFT JOIN orders o ON c.id = o.customer_id;`
    },
    
    // Product-specific queries
    {
        pattern: /(?:show |get |list )?orders? for (\w+)/i,
        template: (match) => `SELECT * FROM orders WHERE product LIKE '%${match[1]}%';`
    },
    {
        pattern: /(?:who|which customers?) (?:bought|ordered) (\w+)/i,
        template: (match) => `SELECT c.name, o.product, o.amount FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.product LIKE '%${match[1]}%';`
    },
    
    // Basic SELECT patterns (must be last - least specific)
    {
        pattern: /(?:show|list|get) all customers/i,
        template: () => `SELECT * FROM customers;`
    },
    {
        pattern: /(?:show|list|get) all orders/i,
        template: () => `SELECT * FROM orders;`
    },
    {
        pattern: /(?:show|list|get) customers/i,
        template: () => `SELECT * FROM customers;`
    },
    {
        pattern: /(?:show|list|get) orders/i,
        template: () => `SELECT * FROM orders;`
    }
];

// Mock SQL Query Executor
class MockSQLExecutor {
    execute(sql) {
        try {
            // Sanitize and validate SQL
            const sanitizedSQL = this.sanitizeSQL(sql);
            
            // Parse and execute the query
            return this.parseAndExecute(sanitizedSQL);
        } catch (error) {
            throw new Error(`SQL Execution Error: ${error.message}`);
        }
    }
    
    sanitizeSQL(sql) {
        // Remove dangerous SQL commands
        const dangerousPatterns = [
            /DROP\s+TABLE/i,
            /DELETE\s+FROM/i,
            /INSERT\s+INTO/i,
            /UPDATE\s+SET/i,
            /CREATE\s+TABLE/i,
            /ALTER\s+TABLE/i,
            /TRUNCATE/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(sql)) {
                throw new Error('Only SELECT queries are allowed');
            }
        }
        
        return sql.trim();
    }
    
    parseAndExecute(sql) {
        // Simple SQL parser for demo purposes
        const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+(.*))?/i);
        
        if (!selectMatch) {
            throw new Error('Invalid SELECT query');
        }
        
        const [, selectClause, tableName, whereAndOtherClauses] = selectMatch;
        
        // Get base table data
        let data = this.getTableData(tableName);
        
        // Handle JOINs
        if (whereAndOtherClauses && whereAndOtherClauses.includes('JOIN')) {
            data = this.handleJoins(data, whereAndOtherClauses, tableName);
        }
        
        // Handle WHERE clause
        if (whereAndOtherClauses && whereAndOtherClauses.includes('WHERE')) {
            data = this.handleWhere(data, whereAndOtherClauses);
        }
        
        // Handle GROUP BY
        if (whereAndOtherClauses && whereAndOtherClauses.includes('GROUP BY')) {
            data = this.handleGroupBy(data, selectClause, whereAndOtherClauses);
        }
        
        // Handle SELECT clause
        data = this.handleSelect(data, selectClause);
        
        // Handle ORDER BY
        if (whereAndOtherClauses && whereAndOtherClauses.includes('ORDER BY')) {
            data = this.handleOrderBy(data, whereAndOtherClauses);
        }
        
        return data;
    }
    
    getTableData(tableName) {
        if (!sampleData[tableName]) {
            throw new Error(`Table '${tableName}' not found`);
        }
        return [...sampleData[tableName]];
    }
    
    handleJoins(leftData, clause, leftTable) {
        const joinMatch = clause.match(/LEFT JOIN (\w+) (\w+) ON (\w+)\.(\w+) = (\w+)\.(\w+)/i);
        
        if (joinMatch) {
            const [, rightTable, rightAlias, leftAlias, leftKey, rightAlias2, rightKey] = joinMatch;
            const rightData = this.getTableData(rightTable);
            
            return leftData.map(leftRow => {
                const matchingRightRows = rightData.filter(rightRow => 
                    leftRow[leftKey] === rightRow[rightKey]
                );
                
                if (matchingRightRows.length === 0) {
                    return leftRow;
                } else {
                    return matchingRightRows.map(rightRow => ({
                        ...leftRow,
                        ...rightRow
                    }));
                }
            }).flat();
        }
        
        return leftData;
    }
    
    handleWhere(data, clause) {
        const whereMatch = clause.match(/WHERE\s+(.*?)(?:\s+GROUP BY|\s+ORDER BY|$)/i);
        
        if (whereMatch) {
            const condition = whereMatch[1].trim();
            
            // Handle different types of conditions
            if (condition.includes('=')) {
                const [field, value] = condition.split('=').map(s => s.trim());
                const cleanValue = value.replace(/'/g, '');
                return data.filter(row => row[field] == cleanValue);
            } else if (condition.includes('>')) {
                const [field, value] = condition.split('>').map(s => s.trim());
                return data.filter(row => parseFloat(row[field]) > parseFloat(value));
            } else if (condition.includes('<')) {
                const [field, value] = condition.split('<').map(s => s.trim());
                return data.filter(row => parseFloat(row[field]) < parseFloat(value));
            } else if (condition.includes('LIKE')) {
                const [field, pattern] = condition.split('LIKE').map(s => s.trim());
                const cleanPattern = pattern.replace(/'/g, '').replace(/%/g, '');
                return data.filter(row => 
                    row[field] && row[field].toString().toLowerCase().includes(cleanPattern.toLowerCase())
                );
            }
        }
        
        return data;
    }
    
    handleGroupBy(data, selectClause, clause) {
        const groupByMatch = clause.match(/GROUP BY\s+(.*?)(?:\s+ORDER BY|$)/i);
        
        if (groupByMatch) {
            const groupFields = groupByMatch[1].split(',').map(f => f.trim());
            
            // Group data
            const groups = {};
            data.forEach(row => {
                const key = groupFields.map(field => {
                    const fieldName = field.split('.')[1] || field;
                    return row[fieldName];
                }).join('|');
                
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(row);
            });
            
            // Apply aggregations
            return Object.values(groups).map(group => {
                const result = { ...group[0] };
                
                // Handle COUNT
                if (selectClause.includes('COUNT')) {
                    const countMatch = selectClause.match(/COUNT\(([^)]+)\)\s+as\s+(\w+)/i);
                    if (countMatch) {
                        result[countMatch[2]] = group.length;
                    }
                }
                
                return result;
            });
        }
        
        return data;
    }
    
    handleSelect(data, selectClause) {
        if (selectClause.trim() === '*') {
            return data;
        }
        
        // Handle aggregate functions
        if (selectClause.includes('AVG')) {
            const avgMatch = selectClause.match(/AVG\((\w+)\)\s+as\s+(\w+)/i);
            if (avgMatch) {
                const [, field, alias] = avgMatch;
                const sum = data.reduce((acc, row) => acc + parseFloat(row[field] || 0), 0);
                return [{ [alias]: sum / data.length }];
            }
        }
        
        if (selectClause.includes('SUM')) {
            const sumMatch = selectClause.match(/SUM\((\w+)\)\s+as\s+(\w+)/i);
            if (sumMatch) {
                const [, field, alias] = sumMatch;
                const sum = data.reduce((acc, row) => acc + parseFloat(row[field] || 0), 0);
                return [{ [alias]: sum }];
            }
        }
        
        if (selectClause.includes('COUNT')) {
            const countMatch = selectClause.match(/COUNT\(([^)]+)\)\s+as\s+(\w+)/i);
            if (countMatch) {
                const [, , alias] = countMatch;
                return [{ [alias]: data.length }];
            }
        }
        
        // Handle specific field selection
        const fields = selectClause.split(',').map(f => f.trim());
        return data.map(row => {
            const newRow = {};
            fields.forEach(field => {
                const fieldName = field.split('.')[1] || field;
                if (row.hasOwnProperty(fieldName)) {
                    newRow[fieldName] = row[fieldName];
                }
            });
            return newRow;
        });
    }
    
    handleOrderBy(data, clause) {
        const orderMatch = clause.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        
        if (orderMatch) {
            const [, field, direction = 'ASC'] = orderMatch;
            
            return data.sort((a, b) => {
                const aVal = a[field];
                const bVal = b[field];
                
                if (direction.toUpperCase() === 'DESC') {
                    return bVal > aVal ? 1 : -1;
                } else {
                    return aVal > bVal ? 1 : -1;
                }
            });
        }
        
        return data;
    }
}

// Application Controller
class NLToSQLApp {
    constructor() {
        this.sqlExecutor = new MockSQLExecutor();
        this.initializeElements();
        this.bindEvents();
        this.renderExamples();
        this.renderHistory();
    }
    
    initializeElements() {
        this.nlQueryInput = document.getElementById('nlQuery');
        this.convertBtn = document.getElementById('convertBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.exampleQueries = document.getElementById('exampleQueries');
        this.queryHistory = document.getElementById('queryHistory');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.errorModal = document.getElementById('errorModal');
        this.errorMessage = document.getElementById('errorMessage');
        this.closeErrorModal = document.getElementById('closeErrorModal');
        this.closeError = document.getElementById('closeError');
        
        this.currentSQL = '';
    }
    
    bindEvents() {
        this.convertBtn.addEventListener('click', () => this.convertQuery());
        this.clearBtn.addEventListener('click', () => this.clearInput());
        this.copyBtn.addEventListener('click', () => this.copySQL());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.closeErrorModal.addEventListener('click', () => this.hideErrorModal());
        this.closeError.addEventListener('click', () => this.hideErrorModal());
        
        // Enter key to convert
        this.nlQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.convertQuery();
            }
        });
        
        // Close modal on backdrop click
        this.errorModal.addEventListener('click', (e) => {
            if (e.target === this.errorModal) {
                this.hideErrorModal();
            }
        });
    }
    
    renderExamples() {
        this.exampleQueries.innerHTML = sampleQueries.map(query => `
            <div class="example-item" data-query="${query.natural_language}">
                <h4>${query.natural_language}</h4>
                <div class="example-sql">${query.sql}</div>
                <p class="example-description">${query.description}</p>
            </div>
        `).join('');
        
        // Bind click events to examples
        this.exampleQueries.addEventListener('click', (e) => {
            const exampleItem = e.target.closest('.example-item');
            if (exampleItem) {
                const query = exampleItem.dataset.query;
                this.nlQueryInput.value = query;
                this.convertQuery();
            }
        });
    }
    
    renderHistory() {
        if (queryHistory.length === 0) {
            this.queryHistory.innerHTML = `
                <div class="empty-state">
                    <p>Your query history will appear here.</p>
                </div>
            `;
            return;
        }
        
        this.queryHistory.innerHTML = queryHistory.map(item => `
            <div class="history-item" data-query="${item.naturalLanguage}">
                <div class="history-query">${item.naturalLanguage}</div>
                <div class="history-sql">${item.sql}</div>
                <div class="history-timestamp">${item.timestamp}</div>
            </div>
        `).join('');
        
        // Bind click events to history items
        this.queryHistory.addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            if (historyItem) {
                const query = historyItem.dataset.query;
                this.nlQueryInput.value = query;
                this.convertQuery();
            }
        });
    }
    
    convertQuery() {
        const naturalLanguage = this.nlQueryInput.value.trim();
        
        if (!naturalLanguage) {
            this.showError('Please enter a natural language query.');
            return;
        }
        
        this.showLoading(true);
        
        // Simulate processing delay
        setTimeout(() => {
            try {
                const sql = this.convertNLToSQL(naturalLanguage);
                const results = this.sqlExecutor.execute(sql);
                
                this.currentSQL = sql;
                this.displayResults(naturalLanguage, sql, results);
                this.addToHistory(naturalLanguage, sql);
                this.copyBtn.classList.remove('hidden');
                
            } catch (error) {
                this.showError(error.message);
            } finally {
                this.showLoading(false);
            }
        }, 1000);
    }
    
    convertNLToSQL(naturalLanguage) {
        const input = naturalLanguage.trim();
        
        // Try each pattern in order (most specific first)
        for (const pattern of conversionPatterns) {
            const match = input.match(pattern.pattern);
            if (match) {
                console.log('Matched pattern:', pattern.pattern, 'with input:', input);
                return pattern.template(match);
            }
        }
        
        throw new Error('Unable to convert this natural language query to SQL. Please try rephrasing or use one of the example queries.');
    }
    
    displayResults(naturalLanguage, sql, results) {
        this.resultsContainer.innerHTML = `
            <div class="query-result">
                <div class="status-message status-message--success">
                    ✓ Query converted and executed successfully
                </div>
                
                <div class="sql-output">
                    <h4>Generated SQL:</h4>
                    <div class="sql-code">${sql}</div>
                </div>
                
                <div class="query-results">
                    <h4>Results (${results.length} row${results.length !== 1 ? 's' : ''}):</h4>
                    ${this.renderTable(results)}
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return '<p>No results found.</p>';
        }
        
        const headers = Object.keys(data[0]);
        
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>
                            ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    addToHistory(naturalLanguage, sql) {
        const historyItem = {
            naturalLanguage,
            sql,
            timestamp: new Date().toLocaleString()
        };
        
        queryHistory.unshift(historyItem);
        
        // Keep only last 10 queries
        if (queryHistory.length > 10) {
            queryHistory = queryHistory.slice(0, 10);
        }
        
        this.renderHistory();
    }
    
    clearInput() {
        this.nlQueryInput.value = '';
        this.resultsContainer.innerHTML = `
            <div class="empty-state">
                <p>Enter a natural language query above to see the generated SQL and results here.</p>
            </div>
        `;
        this.copyBtn.classList.add('hidden');
        this.currentSQL = '';
    }
    
    clearHistory() {
        queryHistory = [];
        this.renderHistory();
    }
    
    copySQL() {
        if (!this.currentSQL) return;
        
        navigator.clipboard.writeText(this.currentSQL).then(() => {
            this.showCopyFeedback();
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentSQL;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showCopyFeedback();
        });
    }
    
    showCopyFeedback() {
        const feedback = document.createElement('div');
        feedback.className = 'copy-feedback';
        feedback.textContent = 'SQL copied to clipboard!';
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            document.body.removeChild(feedback);
        }, 2000);
    }
    
    showLoading(show) {
        const btnText = this.convertBtn.querySelector('.btn-text');
        const spinner = this.convertBtn.querySelector('.loading-spinner');
        
        if (show) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            this.convertBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            this.convertBtn.disabled = false;
        }
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorModal.classList.remove('hidden');
    }
    
    hideErrorModal() {
        this.errorModal.classList.add('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NLToSQLApp();
});