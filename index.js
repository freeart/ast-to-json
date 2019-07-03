function graphqlResolverAst(ast) {
	const state = {
		operation: ast.schema._queryType.toString(),
		schema: [ast.parentType.name, ast.path.key],
		resolverPath: [],
		resolveTo: ast.returnType.toString(),
		fields: {},
		args: null,
		fragments: {},
		variables: ast.variableValues
	};

	let path = ast.path;
	const resolverPath = [].concat(
		ast.parentType.name === 'Query' ? [] : ast.parentType.name, path.key, ast.returnType.toString()
	)

	while (path.prev) {
		path = path.prev;
		resolverPath.unshift(path.key);
	}

	state.resolverPath = resolverPath;

	// ast.fieldNode.length > 1 if the Query has fragments.
	resolveSelectionSet(ast.fieldNodes[0], state)

	/* Object.keys(ast.fragments).forEach(fragmentName => {
		state.fragments[fragmentName] = getSelections(ast.fragments[fragmentName]);
	}); */

	return state;
};

function resolveSelectionSet(fieldNode, state) {
	state.fields = fieldNode.selectionSet.selections
		.map(sel => getSelections(sel, state.variables))
		.reduce((projections, selection) => {
			projections[selection.name] = selection
			return projections;
		}, {});

	state.args = fieldNode.arguments.reduce((projections, argument) => {
		projections[argument.name.value] = getArgumentValue(argument.value, state.variables);
		return projections;
	}, {});

	return state;
}

function getSelections(sel, variables) {
	const obj = { kind: sel.kind, name: sel.name.value, hasSelections: !!sel.selectionSet };
	if (obj.hasSelections) {
		if (sel.selectionSet.selections[0].kind == "InlineFragment") {
			sel.selectionSet = sel.selectionSet.selections[0].selectionSet
		}
		Object.assign(obj, {
			fields: {},
			args: null,
			variables: variables
		})
		resolveSelectionSet(sel, obj)
	}
	return obj;
}

function getArgumentValue(argumentValue, variables) {
	switch (argumentValue.kind) {
		case 'StringValue':
		case 'BooleanValue':
			return argumentValue.value;
		case 'IntValue':
			return parseInt(argumentValue.value, 10);
		case 'FloatValue':
			return parseFloat(argumentValue.value);
		case 'ListValue':
			return argumentValue.values.map(elem => getArgumentValue(elem, variables));
		case 'ObjectValue':
			const obj = {};
			argumentValue.fields.forEach(field => {
				obj[field.name.value] = getArgumentValue(field.value, variables);
			});
			return obj;
		case 'Variable':
			return variables[argumentValue.name.value];
		default:
			throw new Error(`Unexpected GraphQL argument type "${argumentValue.kind}"`);
	}
}

module.exports = graphqlResolverAst;