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
        self.assertNotIn('default', props['table_limit'])
        self.assertNotIn('default', props['table_limit']['description'].lower())
        self.assertNotIn('warnings', result['meta'].get('properties', {}))
        data = result['data']['properties']
        self.assertEqual(data['llm_prompt']['type'], 'string')
        self.assertIn('tabular_data', data)
        for key in ('temporal_facts', 'temporal_duration', 'temporal_filter'):
            self.assertNotIn(key, data)
        chunk = data['chunks']['items']['properties']
        self.assertNotIn('chunk_metadata', chunk)
        for key in ('metadata', 'additional_metadata'):
            self.assertEqual(chunk[key]['type'], 'object')

if __name__ == '__main__': unittest.main()
