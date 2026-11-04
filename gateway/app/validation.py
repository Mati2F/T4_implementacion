"""Validación de profundidad antes de ejecutar resolvers GraphQL."""

from graphql import GraphQLError
from graphql.language import FieldNode, FragmentSpreadNode, InlineFragmentNode
from graphql.validation import ValidationRule


MAX_QUERY_DEPTH = 8


class MaxQueryDepthRule(ValidationRule):
    """Cuenta campos desde 1; los fragmentos no agregan un nivel propio."""

    def enter_operation_definition(self, node, *_args):
        pending = [(node.selection_set, 0, frozenset())]
        visited_fragments = set()

        # Recorrido iterativo: no depende de la recursión de Python.
        while pending:
            selection_set, depth, ancestors = pending.pop()
            for selection in selection_set.selections:
                if isinstance(selection, FieldNode):
                    field_depth = depth + 1
                    if field_depth > MAX_QUERY_DEPTH:
                        self.report_error(GraphQLError(
                            f"La operación GraphQL supera el máximo de {MAX_QUERY_DEPTH} niveles anidados.",
                            nodes=[selection],
                            extensions={
                                "code": "QUERY_DEPTH_EXCEEDED",
                                "maximumDepth": MAX_QUERY_DEPTH,
                            },
                        ))
                        return
                    if selection.selection_set is not None:
                        pending.append((selection.selection_set, field_depth, ancestors))
                elif isinstance(selection, InlineFragmentNode):
                    pending.append((selection.selection_set, depth, ancestors))
                elif isinstance(selection, FragmentSpreadNode):
                    name = selection.name.value
                    key = (name, depth)
                    # Las reglas estándar rechazan ciclos y fragmentos inexistentes.
                    if name in ancestors or key in visited_fragments:
                        continue
                    fragment = self.context.get_fragment(name)
                    if fragment is not None:
                        visited_fragments.add(key)
                        pending.append((fragment.selection_set, depth, ancestors | {name}))
