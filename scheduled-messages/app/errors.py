class DomainError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str
    ):
        super().__init__(message)

        self.status_code = status_code
        self.code = code
        self.message = message


class ScheduleNotFound(DomainError):
    def __init__(self):
        super().__init__(
            status_code=404,
            code="SCHEDULE_NOT_FOUND",
            message="La programación no existe"
        )


class InvalidScheduledTime(DomainError):
    def __init__(self):
        super().__init__(
            status_code=422,
            code="INVALID_SCHEDULED_TIME",
            message=(
                "La fecha programada debe ser futura"
            )
        )


class RelatedResourceNotFound(DomainError):
    def __init__(self, resource: str):
        super().__init__(
            status_code=422,
            code=f"{resource.upper()}_NOT_FOUND",
            message=f"El recurso {resource} no existe"
        )


class DependencyUnavailable(DomainError):
    def __init__(self, dependency: str):
        super().__init__(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message=(
                f"El servicio {dependency} "
                "no está disponible"
            )
        )


class ScheduleCannotBeCancelled(DomainError):
    def __init__(self, current_status: str):
        super().__init__(
            status_code=409,
            code="SCHEDULE_CANNOT_BE_CANCELLED",
            message=(
                "No se puede cancelar una programación "
                f"en estado {current_status}"
            )
        )