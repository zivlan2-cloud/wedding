-- v4 schema additions

-- VAT type on vendors: does the contract price include VAT?
alter table vendors add column if not exists contract_includes_vat boolean default true;
