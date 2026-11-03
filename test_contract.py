import unittest
from pathlib import Path
import yaml

class ContractTest(unittest.TestCase):
    def test_query_contract(self):
        spec = yaml.safe_load(Path(__file__).with_name('openapi.yaml').read_text())
        query = spec['paths']['/query']['post']
        props = query['requestBody']['content']['application/json']['schema']['properties']
        self.assertEqual(props['include_table_sql']['type'], 'boolean')
        self.assertEqual((props['table_limit']['minimum'], props['table_limit']['maximum']), (1, 100))
        result = query['responses']['200']['content']['application/json']['schema']['properties']
        self.assertIn('warnings', result['meta']['properties'])
        data = result['data']['properties']
        for key in ('tabular_data', 'temporal_facts', 'temporal_duration'):
            self.assertIn(key, data)
        self.assertIn('chunk_metadata', data['chunks']['items']['properties'])
        self.assertIn('observed_at', data['temporal_facts']['items']['properties'])
        self.assertIn('collections', result['meta']['properties']['warnings']['items']['properties'])

if __name__ == '__main__': unittest.main()
