exports.handler = async function(event, context) {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    const logs = [];
    const log = (msg) => { logs.push(msg); console.log(msg); };

    try {
          const { apiKey } = JSON.parse(event.body || '{}');
          if (!apiKey) return { statusCode: 400, headers, body: JSON.stringify({ error: 'API key required', logs }) };

      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const apiCall = async (method, path, body) => {
              const cleanPath = path.startsWith('/') ? path : '/' + path;
              const fullPath = '/api/v1' + cleanPath + (cleanPath.endsWith('/') ? '' : '/');
              const url = 'https://app.close.com' + fullPath;
              while (true) {
                        const opts = {
                                    method,
                                    headers: {
                                                  'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
                                                  'Content-Type': 'application/json',
                                                  'Accept': 'application/json'
                                    }
                        };
                        if (body) opts.body = JSON.stringify(body);
                        const res = await fetch(url, opts);
                        if (res.status === 429) {
                                    const retryAfter = parseInt(res.headers.get('Retry-After') || '2') * 1000;
                                    log('Rate limited, waiting ' + retryAfter + 'ms...');
                                    await sleep(retryAfter);
                                    continue;
                        }
                        const text = await res.text();
                        let data;
                        try { data = JSON.parse(text); } catch(e) { data = { _raw: text }; }
                        if (!res.ok) throw new Error(res.status + ': ' + JSON.stringify(data));
                        await sleep(130);
                        return data;
              }
      };

      const apiGet = (path) => apiCall('GET', path);
          const apiPost = (path, body) => apiCall('POST', path, body);
          const apiPut = (path, body) => apiCall('PUT', path, body);

      log('Verifying API key...');
          const me = await apiGet('/me');
          const orgName = (me.organizations && me.organizations[0]) ? me.organizations[0].name : 'Unknown Org';
          log('Connected to: ' + orgName);

      const LEAD_STATUSES = [
              'Kein Interesse', 'Nicht Erreichbar', 'Blacklist', 'Follow Up',
              'Termin Gesetzt', 'Termin Stattgefunden', 'Angebot Gemacht',
              'In Bearbeitung', 'Neuer Lead', 'Abschluss', 'Chargeback',
              'Storno', 'Termin Abgesagt', 'Lead Zurueckgestellt'
            ];

      log('Setting up Lead Statuses (' + LEAD_STATUSES.length + ')...');
          const statusRes = await apiGet('/status/lead');
          const existingStatuses = {};
          (statusRes.data || []).forEach(s => { existingStatuses[s.label.toLowerCase()] = s.id; });
          const statusIds = {};
          for (const label of LEAD_STATUSES) {
                  const key = label.toLowerCase();
                  if (existingStatuses[key]) {
                            statusIds[label] = existingStatuses[key];
                            log('Status exists: ' + label);
                  } else {
                            const created = await apiPost('/status/lead', { label });
                            statusIds[label] = created.id;
                            log('Created status: ' + label);
                  }
          }

      const LEAD_FIELDS = [
        { name: 'Setter Name', type: 'text' },
        { name: 'Setter Email', type: 'text' },
        { name: 'Closer Name', type: 'text' },
        { name: 'Closer Email', type: 'text' },
        { name: 'Kanal', type: 'text' },
        { name: 'Werbemittel', type: 'text' },
        { name: 'Kampagne', type: 'text' },
        { name: 'Terminart', type: 'choices', choices: ['Kaltakquise', 'Empfehlung', 'Inbound'], multiple: false },
        { name: 'Termintyp', type: 'choices', choices: ['Online', 'Vor Ort'], multiple: false },
        { name: 'Grund Kein Termin', type: 'text' },
        { name: 'Wiedervorlage Datum', type: 'date' },
        { name: 'Termin Datum', type: 'date' },
        { name: 'Termin Uhrzeit', type: 'text' },
        { name: 'Stattgefunden', type: 'choices', choices: ['Ja', 'Nein', 'Unbekannt'], multiple: false },
        { name: 'Kein Stattgefunden Grund', type: 'text' },
        { name: 'Abschluss Produkt', type: 'text' },
        { name: 'Abschluss Betrag', type: 'number' },
        { name: 'Chargeback Grund', type: 'text' },
        { name: 'Storno Grund', type: 'text' },
        { name: 'Angebotsbetrag', type: 'number' },
        { name: 'Lead Quelle', type: 'choices', choices: ['Facebook', 'Instagram', 'Google', 'Empfehlung', 'Messe', 'Kaltakquise', 'Sonstige'], multiple: false },
        { name: 'Notizen Setter', type: 'text' },
        { name: 'Notizen Closer', type: 'text' }
            ];

      log('Setting up Lead Custom Fields (' + LEAD_FIELDS.length + ')...');
          const leadFieldsRes = await apiGet('/custom_field_schema/lead');
          const existingLeadFields = {};
          (leadFieldsRes.data || []).forEach(f => { existingLeadFields[f.name.toLowerCase()] = f.id; });
          const leadFieldIds = {};
          for (const field of LEAD_FIELDS) {
                  const key = field.name.toLowerCase();
                  if (existingLeadFields[key]) {
                            leadFieldIds[field.name] = existingLeadFields[key];
                            log('Lead field exists: ' + field.name);
                  } else {
                            const payload = { name: field.name, type: field.type };
                            if (field.choices) payload.choices = field.choices;
                            if (field.multiple !== undefined) payload.multiple = field.multiple;
                            const created = await apiPost('/custom_field_schema/lead', payload);
                            leadFieldIds[field.name] = created.id;
                            log('Created lead field: ' + field.name);
                  }
          }

      const CONTACT_FIELDS = [
        { name: 'Geburtstag', type: 'date' },
        { name: 'Erstellt', type: 'date' },
        { name: 'Position', type: 'text' },
        { name: 'Unternehmen', type: 'text' }
            ];

      log('Setting up Contact Custom Fields (' + CONTACT_FIELDS.length + ')...');
          const contactFieldsRes = await apiGet('/custom_field_schema/contact');
          const existingContactFields = {};
          (contactFieldsRes.data || []).forEach(f => { existingContactFields[f.name.toLowerCase()] = f.id; });
          for (const field of CONTACT_FIELDS) {
                  const key = field.name.toLowerCase();
                  if (existingContactFields[key]) {
                            log('Contact field exists: ' + field.name);
                  } else {
                            await apiPost('/custom_field_schema/contact', { name: field.name, type: field.type });
                            log('Created contact field: ' + field.name);
                  }
          }

      log('Setting up Smart Views...');
          const svRes = await apiGet('/saved_search?type__in=lead,contact&_limit=200');
          const existingSV = {};
          (svRes.data || []).forEach(sv => { existingSV[sv.name.toLowerCase()] = sv; });

      const S = (label) => statusIds[label] || ('MISSING_' + label);
          const makeStatusQuery = (...labels) => ({
                  type: 'and',
                  queries: [{ type: 'field_condition', field: { type: 'lead_status' }, condition: { type: 'choice', values: labels.map(l => S(l)).filter(v => !v.startsWith('MISSING')) } }]
          });

      const SMART_VIEWS = [
        { name: 'Neuer Lead', type: 'lead', query: makeStatusQuery('Neuer Lead') },
        { name: 'Follow Up', type: 'lead', query: makeStatusQuery('Follow Up') },
        { name: 'Nicht Erreichbar', type: 'lead', query: makeStatusQuery('Nicht Erreichbar') },
        { name: 'Termin Gesetzt', type: 'lead', query: makeStatusQuery('Termin Gesetzt') },
        { name: 'Termin Stattgefunden', type: 'lead', query: makeStatusQuery('Termin Stattgefunden') },
        { name: 'Angebot Gemacht', type: 'lead', query: makeStatusQuery('Angebot Gemacht') },
        { name: 'Abschluss', type: 'lead', query: makeStatusQuery('Abschluss') },
        { name: 'Setter - Termine Heute Alle', type: 'lead', query: makeStatusQuery('Termin Gesetzt', 'Termin Stattgefunden') },
        { name: 'AM - Alle Bestandskunden', type: 'lead', query: makeStatusQuery('Abschluss') },
        { name: 'Blacklist', type: 'lead', query: makeStatusQuery('Blacklist') },
        { name: 'Kein Interesse', type: 'lead', query: makeStatusQuery('Kein Interesse') },
        { name: 'In Bearbeitung', type: 'lead', query: makeStatusQuery('In Bearbeitung') },
        { name: 'Chargeback', type: 'lead', query: makeStatusQuery('Chargeback') },
        { name: 'Storno', type: 'lead', query: makeStatusQuery('Storno') },
        { name: 'Termin Abgesagt', type: 'lead', query: makeStatusQuery('Termin Abgesagt') },
        { name: 'Lead Zurueckgestellt', type: 'lead', query: makeStatusQuery('Lead Zurueckgestellt') },
        { name: 'Alle Leads', type: 'lead', query: { type: 'and', queries: [] } },
        { name: 'Alle Kontakte', type: 'contact', query: { type: 'and', queries: [] } },
        { name: 'Wiedervorlage Heute', type: 'lead', query: {
                  type: 'and',
                  queries: [{ type: 'field_condition', field: { type: 'custom_field', custom_field_id: leadFieldIds['Wiedervorlage Datum'] }, condition: { type: 'date', mode: 'today', date_range: { start: null, end: null } } }]
        }}
            ];

      for (const sv of SMART_VIEWS) {
              const key = sv.name.toLowerCase();
              const payload = { name: sv.name, query: sv.query, type: sv.type };
              if (existingSV[key]) {
                        await apiPut('/saved_search/' + existingSV[key].id, payload);
                        log('Updated Smart View: ' + sv.name);
              } else {
                        await apiPost('/saved_search', payload);
                        log('Created Smart View: ' + sv.name);
              }
      }

      log('CRM Setup Complete!');
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, logs }) };

    } catch (err) {
          log('Error: ' + err.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, logs }) };
    }
};
